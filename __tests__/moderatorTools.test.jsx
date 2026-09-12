import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModeratorTools from "../src/features/admin/MODERATORCENTER/ModeratorTools.jsx";
import { readModeratorWeek } from "../src/features/admin/MODERATORCENTER/moderatorWeek.js";
import { getModeratorCenterV2Contract } from "../src/shared/utils/eth.js";

vi.mock("../src/shared/utils/eth.js", () => ({
  getModeratorCenterV2Contract: vi.fn(),
  formatWei: (value) => String(BigInt(value) / 1000000000000000000n),
}));
vi.mock(
  "../src/features/admin/MODERATORCENTER/moderatorWeek.js",
  async (original) => ({
    ...(await original()),
    readModeratorWeek: vi.fn(),
  }),
);

const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x2222222222222222222222222222222222222222";
const data = {
  chainId: 137,
  contract: "0x82Ad5a0f379CCA21AC2979E88AC24db94e670bD8",
  blockNumber: 93471504,
  blockTimestamp: 1788900000,
  week: 2957,
  currentWeek: 2957,
  startsAt: 2957 * 604800,
  endsAt: 2958 * 604800,
  settlesAt: 2958 * 604800 + 86400,
  opened: true,
  status: "In progress",
  configVersion: "12",
  settled: false,
  allocatedWei: "10000000000000000000",
  creditedWei: "0",
  rolledOverWei: "0",
  slots: [
    {
      slotId: 0,
      enabled: true,
      isLeader: true,
      payout: wallet,
      uniqueBuyers: "2",
      paidTickets: "3",
      weight: "230",
    },
    {
      slotId: 1,
      enabled: true,
      isLeader: false,
      payout: otherWallet,
      uniqueBuyers: "1",
      paidTickets: "1",
      weight: "40",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getModeratorCenterV2Contract.mockResolvedValue({ target: data.contract });
  readModeratorWeek.mockResolvedValue(data);
});
afterEach(cleanup);

describe("Moderator Tools", () => {
  it("shows actual weekly pool separately from slot weights, not Merkle or guessed payouts", async () => {
    render(<ModeratorTools walletAddress={wallet} />);
    await screen.findByText("In progress");
    expect(screen.getByText("10 POL")).toBeTruthy();
    expect(
      screen.getByText("Credited to wallets").nextSibling.textContent,
    ).toBe("--");
    expect(screen.getByRole("table").textContent).toContain("230");
    expect(screen.queryByText(/Merkle|Supabase/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /settle|unpause|approve/i }),
    ).toBeNull();
    expect(getModeratorCenterV2Contract).toHaveBeenCalledWith({
      signer: false,
    });
  });

  it("filters historical payout wallets and returns to rewards", async () => {
    const onMyRewards = vi.fn();
    render(<ModeratorTools walletAddress={wallet} onMyRewards={onMyRewards} />);
    await screen.findByText("In progress");
    fireEvent.click(screen.getByRole("checkbox", { name: "My wallet only" }));
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      2,
    );
    fireEvent.click(screen.getByRole("button", { name: "My rewards" }));
    expect(onMyRewards).toHaveBeenCalledOnce();
  });

  it("does not issue RPC calls while editing a week and loads on submission", async () => {
    render(<ModeratorTools />);
    const input = screen.getByRole("spinbutton", { name: "Week ID" });
    await screen.findByText("In progress");
    fireEvent.change(input, { target: { value: "2956" } });
    expect(readModeratorWeek).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Load week" }));
    await waitFor(() =>
      expect(readModeratorWeek).toHaveBeenLastCalledWith(
        expect.anything(),
        2956,
      ),
    );
  });

  it("does not keep a downloadable old report after a failed refresh", async () => {
    render(<ModeratorTools />);
    await screen.findByText("In progress");
    readModeratorWeek.mockRejectedValueOnce(new Error("private RPC details"));
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh weekly data" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /Export JSON/ }).disabled).toBe(
      true,
    );
    expect(screen.queryByText("10 POL")).toBeNull();
    expect(screen.queryByText(/private RPC/)).toBeNull();
  });

  it("shows a genuine unopened state without invented moderator rows", async () => {
    readModeratorWeek.mockResolvedValue({
      ...data,
      opened: false,
      status: "Not opened",
      slots: [],
      configVersion: "0",
      allocatedWei: "0",
    });
    render(<ModeratorTools />);
    await screen.findByText("Not opened");
    expect(
      screen.getByText("No on-chain activity has opened this week."),
    ).toBeTruthy();
    expect(screen.getByRole("checkbox").disabled).toBe(true);
  });

  it("exports the complete exact report without requesting a signature", async () => {
    const create = vi.fn().mockReturnValue("blob:report");
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<ModeratorTools walletAddress={wallet} />);
    await screen.findByText("In progress");
    fireEvent.click(screen.getByRole("button", { name: /Export JSON/ }));
    expect(create.mock.calls[0][0].type).toBe("application/json");
    expect(click).toHaveBeenCalledOnce();
    expect(
      getModeratorCenterV2Contract.mock.calls.every(
        ([options]) => !options.signer,
      ),
    ).toBe(true);
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
