import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const Z_INDEX = {
  50: "z-[50]",
  9998: "z-[9998]",
  9999: "z-[9999]",
};

/* Shared modal wrapper: fixed overlay + Escape/scroll-lock handling.
   `z` must be one of 50 | 9998 | 9999 to keep valid Tailwind classes. */
const Modal = ({ isOpen, onClose, z = 50, children }) => {
  useEffect(() => {
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${Z_INDEX[z]} flex overflow-y-auto px-4 sm:px-10 lg:px-20 py-6 [&>*]:m-auto`}
    >
      <div
        className="absolute inset-0 bg-[#16263A]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {children}
    </div>,
    document.body
  );
};

const ModalHeader = ({ title, subtitle, batteryId, onClose }) => (
  <div className="shrink-0 flex items-center justify-between p-6 border-b border-[#EEE9DA] bg-[#FFFDF8]">
    <div>
      {subtitle && <p className="text-xs font-semibold text-[#9A8240]">{subtitle}</p>}
      <h2 className="mt-1 text-xl font-bold">{title}</h2>
      {batteryId && <p className="mt-1 text-sm text-[#747B83]">Battery: {batteryId}</p>}
    </div>
    <button
      type="button"
      onClick={onClose}
      className="w-10 h-10 rounded-xl bg-[#F5F1E7] flex items-center justify-center hover:bg-[#E7E1D3] transition-colors"
      aria-label="Close modal"
    >
      <X className="w-5 h-5" />
    </button>
  </div>
);

export { Modal, ModalHeader };
export default Modal;
