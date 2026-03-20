// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./Library/BiggiErrorsLib.sol";
import "./Library/BiggiSwapLib.sol";

/// @dev Minimal router rozhraní kompatibilní s UniswapV2-like
interface IUniswapV2Router02 {
    function WETH() external view returns (address);

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function getAmountsOut(uint amountIn, address[] calldata path)
        external
        view
        returns (uint[] memory amounts);
}

/// @dev Minimal rozhraní BiggiDripDistributor
interface IBiggiDripDistributor {
    function availableTokens() external view returns (uint256);
    function claim(uint256 amountRequested) external;
    function claimTo(address to, uint256 amountRequested) external;
    function setTokensPerMintFromOperator(uint256 v) external;
}

/// @dev ModeratorCenter receiver hook
interface IModeratorCenter {
    function notifyAllocation() external payable;
}

/**
 * @title BiggiDripLMToModerator
 * @notice Claimne BIGGI z DripDistributor, prodá na native a pošle vše do ModeratorCenter.
 *         Používá se jako dripLM v BuybackAgentu i DripDistributor.
 */
contract BiggiDripLMToModerator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    IERC20 public immutable BIGGI;
    IUniswapV2Router02 public router;

    IBiggiDripDistributor public dripDistributor;
    address public reserve;
    address public buybackAgent;
    address public moderatorCenter;

    uint8  public sellPct = 70;            // kolik % z nahlášeného množství buybacku se prodá
    uint256 public slippageBps = 200;      // 2% fallback slippage
    uint256 public txDeadlineSec = 600;    // 10 minut
    uint16 public reserveShareBps = 5000;  // 50% do reserve
    uint16 public moderatorShareBps = 5000; // 50% do moderator

    event RouterSet(address indexed oldR, address indexed newR);
    event ReserveSet(address indexed oldR, address indexed newR);
    event DripDistributorSet(address indexed oldD, address indexed newD);
    event BuybackAgentSet(address indexed oldA, address indexed newA);
    event ModeratorCenterSet(address indexed oldM, address indexed newM);
    event SharesSet(uint16 reserveBps, uint16 moderatorBps);

    event SellPctSet(uint8 oldPct, uint8 newPct);
    event SlippageSet(uint256 oldBps, uint256 newBps);
    event DeadlineSet(uint256 oldSec, uint256 newSec);
    event TokensPerMintUpdated(uint256 newTokensPerMint);

    event DripClaimed(uint256 amountClaimed);
    event DripExecuted(uint256 soldTokens, uint256 nativeForwarded);
    event DripPartial(uint256 requested, uint256 sold, uint256 nativeForwarded, bool sent);
    event DripFailed(string reason);

    constructor(address token_, address router_, address initialOwner) Ownable(initialOwner) {
        if (token_ == address(0)) revert BiggiErrorsLib.TokenNotSet();
        if (router_ == address(0)) revert BiggiErrorsLib.RouterNotSet();
        if (initialOwner == address(0)) revert BiggiErrorsLib.ZeroAddress();
        BIGGI = IERC20(token_);
        router = IUniswapV2Router02(router_);
    }

    modifier onlyBuybackAgent() {
        if (msg.sender != buybackAgent) revert BiggiErrorsLib.NotBuybackAgent();
        _;
    }

    /* ---------- setters (owner) ---------- */
    function setRouter(address r) external onlyOwner {
        if (r == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit RouterSet(address(router), r);
        router = IUniswapV2Router02(r);
    }

    function setDripDistributor(address d) external onlyOwner {
        if (d == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit DripDistributorSet(address(dripDistributor), d);
        dripDistributor = IBiggiDripDistributor(d);
    }

    function setReserve(address r) external onlyOwner {
        if (r == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit ReserveSet(reserve, r);
        reserve = r;
    }

    function setBuybackAgent(address a) external onlyOwner {
        if (a == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit BuybackAgentSet(buybackAgent, a);
        buybackAgent = a;
    }

    function setModeratorCenter(address m) external onlyOwner {
        if (m == address(0)) revert BiggiErrorsLib.ZeroAddress();
        emit ModeratorCenterSet(moderatorCenter, m);
        moderatorCenter = m;
    }

    function setSellPct(uint8 pct) external onlyOwner {
        require(pct <= 100, "pct>100");
        emit SellPctSet(sellPct, pct);
        sellPct = pct;
    }

    function setShares(uint16 reserveBps_, uint16 moderatorBps_) external onlyOwner {
        require(uint256(reserveBps_) + uint256(moderatorBps_) == 10_000, "sum!=10000");
        reserveShareBps = reserveBps_;
        moderatorShareBps = moderatorBps_;
        emit SharesSet(reserveBps_, moderatorBps_);
    }

    function setSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 10000, "bps>10000");
        emit SlippageSet(slippageBps, bps);
        slippageBps = bps;
    }

    function setTxDeadlineSec(uint256 sec_) external onlyOwner {
        require(sec_ > 0 && sec_ <= 1 days, "bad-deadline");
        emit DeadlineSet(txDeadlineSec, sec_);
        txDeadlineSec = sec_;
    }

    /* ---------- core: volá buybackAgent po úspěšném buybacku ---------- */
    function dripOnBuy(uint256 biggiBought) external nonReentrant onlyBuybackAgent {
        if (biggiBought == 0) { emit DripFailed("zero reported"); return; }
        if (address(router) == address(0)) { emit DripFailed("router not set"); return; }
        if (reserve == address(0)) { emit DripFailed("reserve not set"); return; }
        if (moderatorCenter == address(0)) { emit DripFailed("moderatorCenter not set"); return; }

        // update tokensPerMint on distributor to 70% of buyback amount (if operator set)
        if (address(dripDistributor) != address(0)) {
            uint256 tpm = (uint256(biggiBought) * 70) / 100;
            try dripDistributor.setTokensPerMintFromOperator(tpm) {
                emit TokensPerMintUpdated(tpm);
            } catch {}
        }

        uint256 toSell = (uint256(biggiBought) * uint256(sellPct)) / 100;
        if (toSell == 0) { emit DripFailed("toSell==0"); return; }

        // 1) claim z DripDistributor (pokud nastaven)
        uint256 claimed = 0;
        if (address(dripDistributor) != address(0)) {
            try dripDistributor.availableTokens() returns (uint256 avail) {
                uint256 want = toSell;
                if (avail < want) want = avail;
                if (want > 0) {
                    try dripDistributor.claim(want) {
                        claimed = want;
                        emit DripClaimed(claimed);
                    } catch {
                        emit DripFailed("claim failed");
                    }
                }
            } catch {
                try dripDistributor.claim(toSell) {
                    claimed = toSell;
                    emit DripClaimed(claimed);
                } catch {
                    emit DripFailed("claim attempt failed");
                }
            }
        }

        // 2) kolik máme k dispozici k prodeji
        uint256 bal = BIGGI.balanceOf(address(this));
        uint256 sellAmount = toSell;
        if (sellAmount > bal) sellAmount = bal;
        if (sellAmount == 0) { emit DripFailed("nothing to sell"); return; }

        // 3) approve router
        uint256 curAllowance = BIGGI.allowance(address(this), address(router));
        if (curAllowance < sellAmount) {
            if (curAllowance != 0) {
                BIGGI.approve(address(router), 0);
            }
            BIGGI.approve(address(router), sellAmount);
        }

        // 4) path (token -> WETH/WPOL)
        address[] memory path = BiggiSwapLib.pathTokenToNative(address(BIGGI), router.WETH());

        // 5) minOut
        uint256 minOut = BiggiSwapLib.quoteMinOut(
            IUniswapV2Router02Biggi(address(router)),
            sellAmount,
            path,
            slippageBps
        );

        uint256 deadline = block.timestamp + txDeadlineSec;

        // 6) swap
        try router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellAmount,
            minOut,
            path,
            address(this),
            deadline
        ) {
        } catch {
            emit DripFailed("swap failed");
            return;
        }

        // 7) split native => reserve + ModeratorCenter.notifyAllocation()
        uint256 nativeBal = address(this).balance;
        if (nativeBal == 0) { emit DripFailed("no native after swap"); return; }

        uint256 toReserve = (nativeBal * uint256(reserveShareBps)) / 10_000;
        uint256 toModerator = nativeBal - toReserve;

        bool sentReserve = true;
        if (toReserve > 0) {
            (sentReserve, ) = payable(reserve).call{value: toReserve}("");
        }

        bool sentMod = false;
        if (toModerator > 0) {
            try IModeratorCenter(moderatorCenter).notifyAllocation{value: toModerator}() {
                sentMod = true;
            } catch {
                (sentMod, ) = moderatorCenter.call{value: toModerator}("");
            }
        }

        if (sentReserve && sentMod) {
            emit DripExecuted(sellAmount, nativeBal);
        } else {
            emit DripPartial(toSell, sellAmount, nativeBal, sentReserve && sentMod);
        }
    }

    /* ---------- rescue/admin ---------- */
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert BiggiErrorsLib.ToZero();
        to.sendValue(amount);
    }

    receive() external payable {}
    fallback() external payable {}
}
