import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OwnershipTransferSection from "./OwnershipTransferSection";
import { useBattery } from "../../../context/BatteryContext";
import { createOwnershipTransfer, cancelOwnershipTransfer } from "../../../services";

vi.mock("../../../context/BatteryContext", () => ({ useBattery: vi.fn() }));
vi.mock("../../../services", () => ({
  createOwnershipTransfer: vi.fn(),
  cancelOwnershipTransfer: vi.fn(),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,QRFake") },
}));

const OWNER = { id: "user-1", email: "owner@example.com" };
const BATTERY = { id: "batt-1", ownerId: "user-1", modelName: "MaxVolt 100Ah" };
const TOKEN = "tok-43-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const mintedPayload = ({ previousCodeSuperseded = false, expiresAt } = {}) => ({
  token: TOKEN,
  qrPayload: `maxspace-transfer:${TOKEN}`,
  previousCodeSuperseded,
  transfer: {
    expiresAt: expiresAt || new Date(Date.now() + 600 * 1000).toISOString(),
    batteryIdMasked: "BATT…9823",
    batteryModel: "MaxVolt 100Ah",
  },
});

const setupContext = (overrides = {}) => {
  const ctx = {
    userProfile: OWNER,
    addToast: vi.fn(),
    ...overrides,
  };
  useBattery.mockReturnValue(ctx);
  return ctx;
};

beforeEach(() => {
  setupContext();
});

describe("OwnershipTransferSection", () => {
  it("renders nothing when the viewer is not the owner", () => {
    setupContext({ userProfile: { id: "someone-else" } });
    const { container } = render(<OwnershipTransferSection battery={BATTERY} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Ownership Transfer")).not.toBeInTheDocument();
  });

  it("renders nothing without a signed-in profile", () => {
    setupContext({ userProfile: null });
    const { container } = render(<OwnershipTransferSection battery={BATTERY} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the transfer card and button for the owner", () => {
    render(<OwnershipTransferSection battery={BATTERY} />);
    expect(screen.getByText("Ownership Transfer")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Transfer Ownership/i })
    ).toBeInTheDocument();
  });

  it("opens the confirmation modal with the permanent-loss warning", () => {
    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));

    expect(screen.getByText("Transfer ownership?")).toBeInTheDocument();
    expect(
      screen.getByText(/leaves your account permanently/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Transfer ownership?")).not.toBeInTheDocument();
    expect(createOwnershipTransfer).not.toHaveBeenCalled();
  });

  it("mints a code and shows the QR with a live countdown", async () => {
    const { addToast } = setupContext();
    createOwnershipTransfer.mockResolvedValue(mintedPayload());

    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));

    expect(await screen.findByText("One-time transfer code")).toBeInTheDocument();
    expect(createOwnershipTransfer).toHaveBeenCalledWith("batt-1");
    expect(
      screen.getByAltText("One-time ownership transfer QR code")
    ).toBeInTheDocument();
    expect(screen.getByText(/Expires in \d+:\d{2}/)).toBeInTheDocument();
    expect(addToast).toHaveBeenCalledWith(
      "Transfer code ready",
      expect.stringContaining("10 minutes"),
      "success"
    );
  });

  it("warns when a new code supersedes a previous one", async () => {
    const { addToast } = setupContext();
    createOwnershipTransfer.mockResolvedValue(
      mintedPayload({ previousCodeSuperseded: true })
    );
    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));

    await screen.findByText("One-time transfer code");
    expect(addToast).toHaveBeenCalledWith(
      "Previous code replaced",
      expect.any(String),
      "info"
    );
  });

  it("shows an error toast and returns to idle when minting fails", async () => {
    const { addToast } = setupContext();
    createOwnershipTransfer.mockRejectedValue(new Error("Battery not found"));

    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        "Could not start the transfer",
        "Battery not found",
        "error"
      )
    );
    expect(screen.queryByText("One-time transfer code")).not.toBeInTheDocument();
    expect(screen.getByText("Ownership Transfer")).toBeInTheDocument();
  });

  it("keeps the code live after closing and reuses it on the next click", async () => {
    createOwnershipTransfer.mockResolvedValue(mintedPayload());

    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));
    await screen.findByText("One-time transfer code");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("One-time transfer code")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    expect(await screen.findByText("One-time transfer code")).toBeInTheDocument();
    expect(createOwnershipTransfer).toHaveBeenCalledTimes(1);
  });

  it("cancels the live code from the QR window", async () => {
    const { addToast } = setupContext();
    createOwnershipTransfer.mockResolvedValue(mintedPayload());
    cancelOwnershipTransfer.mockResolvedValue({ success: true });

    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));
    await screen.findByText("One-time transfer code");

    fireEvent.click(screen.getByRole("button", { name: "Cancel transfer" }));

    await waitFor(() =>
      expect(cancelOwnershipTransfer).toHaveBeenCalledWith(TOKEN)
    );
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        "Transfer cancelled",
        expect.any(String),
        "info"
      )
    );
    expect(screen.queryByText("One-time transfer code")).not.toBeInTheDocument();
  });

  it("keeps the QR open and toasts an error when cancellation fails", async () => {
    const { addToast } = setupContext();
    createOwnershipTransfer.mockResolvedValue(mintedPayload());
    cancelOwnershipTransfer.mockRejectedValue(new Error("network down"));

    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));
    await screen.findByText("One-time transfer code");

    fireEvent.click(screen.getByRole("button", { name: "Cancel transfer" }));

    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith(
        "Could not cancel the transfer",
        "network down",
        "error"
      )
    );
    expect(screen.getByText("One-time transfer code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel transfer" })).toBeEnabled();
  });

  it("shows the expired state with a regenerate option", async () => {
    createOwnershipTransfer.mockResolvedValue(
      mintedPayload({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    );

    render(<OwnershipTransferSection battery={BATTERY} />);
    fireEvent.click(screen.getByRole("button", { name: /Transfer Ownership/i }));
    fireEvent.click(screen.getByRole("button", { name: "Generate QR code" }));

    expect(await screen.findByText("This code has expired")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate a new code" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Cancel transfer" })
    ).toBeDisabled();
  });
});
