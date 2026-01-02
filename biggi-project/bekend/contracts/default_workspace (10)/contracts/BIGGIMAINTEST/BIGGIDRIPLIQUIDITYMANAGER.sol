// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./BiggiErrorsLib.sol";
import "./BiggiSwapLib.sol";

/// @dev Minimalní router rozhraní kompatibilní s UniswapV2-like
interface IUniswapV2Router02 {
    function WETH() external view returns (address);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

/// @dev Minimalní rozhraní DripDistributor
interface IDripDistributor {
    function availableTokens() external view returns (uint256);
    function claim(address to, uint256 amount) external;
}

/// @dev Reserve receiver hook
interface IReserveReceiver {
    function receiveMintShare() external payable;
}

contract BiggiDripLiquidityManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    IERC20 public immutable BIGGI;
    IUniswapV2Router02 public router;
    address public reserve;
    IDripDistributor public dripDistributor;
    address public buybackAgent;

    uint8  public sellPct = 70;            // kolik % z nahlášeného množství buybacku se prodá (výchozí 70%)
    uint256 public slippageBps = 200;      // 2% fallback slippage
    uint256 public txDeadlineSec = 600;    // 10 minut

    event RouterSet(address indexed oldR, address indexed newR);
    event ReserveSet(address indexed oldR, address indexed newR);
    event DripDistributorSet(address indexed oldD, address indexed newD);
    event BuybackAgentSet(address indexed oldA, address indexed newA);
    event SellPctSet(uint8 oldPct, uint8 newPct);
    event SlippageSet(uint256 oldBps, uint256 newBps);
    event DeadlineSet(uint256 oldSec, uint256 newSec);

    event DripClaimed(uint256 amountClaimed);
    event DripExecuted(uint256 soldTokens, uint256 nativeForwarded);
    event DripPartial(uint256 requested, uint256 sold, uint256 nativeForwarded, bool reserveSent);
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

    function setReserve(address r) external onlyOwner {
        emit ReserveSet(reserve, r);
        reserve = r;
    }

    function setDripDistributor(address d) external onlyOwner {
        emit DripDistributorSet(address(dripDistributor), d);
        dripDistributor = IDripDistributor(d);
    }

    function setBuybackAgent(address a) external onlyOwner {
        emit BuybackAgentSet(buybackAgent, a);
        buybackAgent = a;
    }

    function setSellPct(uint8 pct) external onlyOwner {
        require(pct <= 100, "pct>100");
        emit SellPctSet(sellPct, pct);
        sellPct = pct;
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
    /// @notice buybackAgent zavolá tuto funkci s množstvím BIGGI, které koupil
    /// Contract poté zkusí ze DripDistributor claimnout (pokud je nastaven), prodá tokeny a
    /// forwardne VŠECHEN získaný native do reserve.
    function dripOnBuy(uint256 biggiBought) external nonReentrant onlyBuybackAgent {
        if (biggiBought == 0) { emit DripFailed("zero reported"); return; }
        if (reserve == address(0)) { emit DripFailed("reserve not set"); return; }
        if (address(router) == address(0)) { emit DripFailed("router not set"); return; }

        // spočítat kolik prodáme
        uint256 toSell = (uint256(biggiBought) * uint256(sellPct)) / 100;
        if (toSell == 0) { emit DripFailed("toSell==0"); return; }

        // 1) pokusit se claimnout z dripDistributor (pokud nastaven)
        uint256 claimed = 0;
        if (address(dripDistributor) != address(0)) {
            bool tried = false;
            try dripDistributor.availableTokens() returns (uint256 avail) {
                tried = true;
                uint256 want = toSell;
                if (avail < want) want = avail;
                if (want > 0) {
                    try dripDistributor.claim(address(this), want) {
                        claimed = want;
                        emit DripClaimed(claimed);
                    } catch {
                        emit DripFailed("claim failed");
                    }
                }
            } catch {
                // fallback: přímo se pokusíme claimnout toSell
                try dripDistributor.claim(address(this), toSell) {
                    claimed = toSell;
                    emit DripClaimed(claimed);
                } catch {
                    if (!tried) emit DripFailed("claim attempt failed");
                }
            }
        }

        // 2) kolik máme k dispozici k prodeji
        uint256 bal = BIGGI.balanceOf(address(this));
        uint256 sellAmount = toSell;
        if (sellAmount > bal) sellAmount = bal;

        if (sellAmount == 0) {
            emit DripFailed("nothing to sell");
            return;
        }

        // 3) approve router (safe)
        uint256 curAllowance = BIGGI.allowance(address(this), address(router));
        if (curAllowance < sellAmount) {
            if (curAllowance != 0) {
                BIGGI.approve(address(router), 0);
            }
            BIGGI.approve(address(router), sellAmount);
        }

        // 4) sestavit path (token -> WETH/WMATIC)
        address[] memory path = BiggiSwapLib.pathTokenToNative(address(BIGGI), router.WETH());

        // 5) zkusit on-chain quote pro výpočet minOut přes BiggiSwapLib
        uint256 minOut = BiggiSwapLib.quoteMinOut(
            IUniswapV2Router02Biggi(address(router)),
            sellAmount,
            path,
            slippageBps
        );

        uint256 deadline = block.timestamp + txDeadlineSec;

        // 6) provést swap token -> native
        try router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellAmount,
            minOut,
            path,
            address(this),
            deadline
        ) {
            // swap OK
        } catch {
            emit DripFailed("swap failed");
            return;
        }

        // 7) forward native — VŠECHNO jde do reserve (prefer receiveMintShare hook)
        uint256 nativeBal = address(this).balance;
        if (nativeBal == 0) {
            emit DripFailed("no native after swap");
            return;
        }

        bool reserveSent = false;
        if (reserve != address(0)) {
            try IReserveReceiver(reserve).receiveMintShare{value: nativeBal}() {
                reserveSent = true;
            } catch {
                (reserveSent, ) = reserve.call{value: nativeBal}("");
            }
        }

        if (reserveSent) {
            emit DripExecuted(sellAmount, nativeBal);
        } else {
            emit DripPartial(toSell, sellAmount, nativeBal, reserveSent);
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