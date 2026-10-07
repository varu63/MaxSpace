import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BatteryOwnershipTransferPage from "./BatteryOwnershipTransferPage";
import { useBattery } from "../../context/BatteryContext";
import {
  fetchOwnershipTransfer,
  acceptOwnershipTransfer,
} from "../../services";

vi.mock("../../context/BatteryContext", () => ({ useBattery: vi.fn() }));
vi.mock("../../services", () => ({
  fetchOwnershipTransfer: vi.fn(),
  acceptOwnershipTransfer: vi.fn(),
}));

const TOKEN = "tok-43-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const pendingTransfer = (overrides = {}) => ({
  status: "pending",
  batteryIdMasked: "BATT…9823",
  batteryModel: "MaxVolt 100Ah",
  expiresInMs: 600000,
  isOwnTransfer: false,
  ...overrides,
});

const apiError = (props) => Object.assign(new Error(props.message || "api error"), props);

const renderPage = (token = TOKEN) =>
  render(
    <MemoryRouter initialEntries={[`/transfer/${token}`]}>
      <Routes>
        <Route path="/transfer/:token" element={<BatteryOwnershipTransferPage />} />
      </Routes>
    </MemoryRouter>
  );

const setupContext = (overrides = {}) => {
  const ctx = {
    addToast: vi.fn(),
    findBatteryByBarcode: vi.fn(async () => ({ id: "batt-9", modelName: "MaxVolt 100Ah" })),
    setBatteries: vi.fn(),
    userProfile: { id: "user-2", email: "new@example.com" },
    ...overrides,
  };
  useBattery.mockReturnValue(ctx);
  return ctx;
};

beforeEach(() => {
  setupContext();
});

describe("BatteryOwnershipTransferPage", () => {
  it("shows the ready screen for a live pending transfer", async () => {
    fetchOwnershipTransfer.mockResolvedValue({ transfer: pendingTransfer() });

    renderPage();

    expect(
      await screen.findByText("Accept ownership transfer")
    ).toBeInTheDocument();
    expect(screen.getByText("MaxVolt 100Ah")).toBeInTheDocument();
    expect(screen.getByText("BATT…9823")).toBeInTheDocument();
    expect(screen.getByText(/Live · \d+:\d{2} left/)).toBeInTheDocument();
    expect(screen.getByText(/Accepting as/)).toHaveTextContent("new@example.com");
    expect(
      screen.getByRole("button", { name: /Accept Ownership/i })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("warns and disables Accept for your own transfer code", async () => {
    fetchOwnershipTransfer.mockResolvedValue({
      transfer: pendingTransfer({ isOwnTransfer: true }),
    });

    renderPage();

    expect(
      await screen.findByText(/signed in as the account that created this code/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Accept Ownership/i })
    ).toBeDisabled();
  });

  it.each([
    ["accepted", "This code has already been used"],
    ["cancelled", "This transfer was cancelled"],
    ["expired", "This transfer code has expired"],
  ])("maps a 200 read with status=%s to the %s view", async (status, title) => {
    fetchOwnershipTransfer.mockResolvedValue({
      transfer: pendingTransfer({ status }),
    });

    renderPage();

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByText("Accept ownership transfer")).not.toBeInTheDocument();
  });

  it("treats a pending transfer with elapsed time as expired", async () => {
    fetchOwnershipTransfer.mockResolvedValue({
      transfer: pendingTransfer({ expiresInMs: -1 }),
    });

    renderPage();

    expect(
      await screen.findByText("This transfer code has expired")
    ).toBeInTheDocument();
  });

  it("shows the not-found view when the read answers 404", async () => {
    fetchOwnershipTransfer.mockRejectedValue(apiError({ status: 404 }));

    renderPage();

    expect(await screen.findByText("Transfer code not found")).toBeInTheDocument();
  });

  it("shows the forbidden view when the account may not participate", async () => {
    fetchOwnershipTransfer.mockRejectedValue(
      apiError({
        status: 403,
        code: "forbidden",
        message: "External partner accounts cannot take part in ownership transfers.",
      })
    );

    renderPage();

    expect(
      await screen.findByText("You cannot take part in this transfer")
    ).toBeInTheDocument();
    expect(screen.getByText(/partner accounts cannot take part/i)).toBeInTheDocument();
  });

  it("accepts the transfer, toasts, and refreshes the fleet list", async () => {
    const { addToast, findBatteryByBarcode, setBatteries } = setupContext();
    fetchOwnershipTransfer.mockResolvedValue({ transfer: pendingTransfer() });
    acceptOwnershipTransfer.mockResolvedValue({
      message: "Battery ownership transferred successfully.",
      battery: { id: "batt-9", modelName: "MaxVolt 100Ah" },
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Accept Ownership/i }));

    expect(await screen.findByText(/now belongs to your account/i)).toBeInTheDocument();
    expect(acceptOwnershipTransfer).toHaveBeenCalledWith(TOKEN);
    expect(addToast).toHaveBeenCalledWith(
      "Ownership transferred",
      "Battery ownership transferred successfully.",
      "success"
    );
    expect(findBatteryByBarcode).toHaveBeenCalledWith("batt-9");
    expect(setBatteries).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /View Battery Passport/i })
    ).toBeInTheDocument();
  });

  it("replaces the view when Accept reports a spent code", async () => {
    const { addToast } = setupContext();
    fetchOwnershipTransfer.mockResolvedValue({ transfer: pendingTransfer() });
    acceptOwnershipTransfer.mockRejectedValue(
      apiError({ status: 409, code: "transfer_already_used" })
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Accept Ownership/i }));

    expect(
      await screen.findByText("This code has already been used")
    ).toBeInTheDocument();
    expect(addToast).toHaveBeenCalledWith(
      "Could not accept transfer",
      expect.stringContaining("exactly once"),
      "error"
    );
  });

  it("keeps the ready view and shows an inline error on a server failure", async () => {
    const { addToast } = setupContext();
    fetchOwnershipTransfer.mockResolvedValue({ transfer: pendingTransfer() });
    acceptOwnershipTransfer.mockRejectedValue(
      apiError({ status: 500, message: "boom" })
    );

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Accept Ownership/i }));

    expect(
      await screen.findByText("Something went wrong on our side. Please try again in a moment.")
    ).toBeInTheDocument();
    expect(screen.getByText("Accept ownership transfer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept Ownership/i })).toBeEnabled();
    expect(addToast).toHaveBeenCalledWith(
      "Could not accept transfer",
      expect.stringContaining("Something went wrong on our side"),
      "error"
    );
  });

  it("ignores a failed list refresh after a successful accept", async () => {
    setupContext({
      findBatteryByBarcode: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    fetchOwnershipTransfer.mockResolvedValue({ transfer: pendingTransfer() });
    acceptOwnershipTransfer.mockResolvedValue({
      message: "Battery ownership transferred successfully.",
      battery: { id: "batt-9", modelName: "MaxVolt 100Ah" },
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Accept Ownership/i }));

    expect(await screen.findByText(/now belongs to your account/i)).toBeInTheDocument();
    await waitFor(() => expect(acceptOwnershipTransfer).toHaveBeenCalled());
  });
});
