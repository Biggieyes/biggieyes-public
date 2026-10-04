import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  contract: null,
  createContract: vi.fn(),
  assertWriteContext: vi.fn(),
  waitForWriteReceipt: vi.fn(),
}));

vi.mock("ethers", async (importOriginal) => ({
  ...(await importOriginal()),
  Contract: vi.fn(function (...args) {
    return mocks.createContract(...args);
  }),
}));

vi.mock("@/shared/utils/writeRetry", () => ({
  assertWriteContext: mocks.assertWriteContext,
  waitForWriteReceipt: mocks.waitForWriteReceipt,
}));

import TokenRewardsService from "../src/shared/services/tokenRewardsService.js";

const rewardsAddress = `0x${"1".repeat(40)}`;
const walletAddress = `0x${"2".repeat(40)}`;

beforeEach(() => {
  const transaction = { hash: `0x${"a".repeat(64)}` };
  const claim = vi.fn().mockResolvedValue(transaction);
  claim.estimateGas = vi.fn().mockResolvedValue(100n);
  const signedContract = { claim, runner: null };
  mocks.contract = {
    connect: vi.fn(() => signedContract),
    signedContract,
    transaction,
  };
  mocks.createContract.mockReset().mockReturnValue(mocks.contract);
  mocks.assertWriteContext.mockReset().mockResolvedValue(undefined);
  mocks.waitForWriteReceipt
    .mockReset()
    .mockResolvedValue({ status: 1, hash: transaction.hash });
});

describe("TokenRewardsService writes", () => {
  it("uses the ethers v6 method estimate and waits for one confirmation", async () => {
    const signer = {
      provider: { getNetwork: vi.fn(async () => ({ chainId: 137n })) },
      getAddress: vi.fn(async () => walletAddress),
    };
    mocks.contract.signedContract.runner = signer;
    const service = new TokenRewardsService(rewardsAddress, signer.provider);
    service.connectWithSigner(signer, walletAddress);

    const receipt = await service.claim([1n]);

    expect(mocks.contract.signedContract.claim.estimateGas).toHaveBeenCalledWith(
      [1n],
      {},
    );
    expect(mocks.contract.signedContract.claim).toHaveBeenCalledTimes(1);
    expect(mocks.contract.signedContract.claim).toHaveBeenCalledWith([1n], {
      gasLimit: 120n,
    });
    expect(mocks.assertWriteContext).toHaveBeenCalledWith(
      expect.objectContaining({ account: walletAddress, chainId: 137 }),
    );
    expect(mocks.waitForWriteReceipt).toHaveBeenCalledWith(
      mocks.contract.transaction,
      1,
    );
    expect(receipt.status).toBe(1);
  });
});
