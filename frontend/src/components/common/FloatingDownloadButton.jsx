import { Download } from "lucide-react";
import { getStoreLink } from "./storeLinks";

const FloatingDownloadButton = () => {
  return (
    <a
      href={getStoreLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get the MaxSpace app"
      className="group fixed bottom-24 right-6 z-40 flex items-center gap-2 outline-none"
    >
      <span className="pointer-events-none px-3 py-1.5 rounded-xl bg-[#173B5C] text-white text-xs font-bold whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100">
        Get App
      </span>

      <span className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#F5F1E7] border border-[#E7E1D3] shadow-[0_10px_30px_-8px_rgba(22,38,58,0.35)] transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-12px_rgba(22,38,58,0.45)] group-hover:border-yellow-300 group-active:scale-95">
        <span className="relative w-10 h-10 rounded-full overflow-hidden">
          <img
            src="/Logo.jpeg"
            alt="MaxSpace"
            className="w-full h-full object-scale-down"
          />
        </span>

        <span className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-[#173B5C] text-yellow-400 border-2 border-white shadow-md transition-transform duration-300 group-hover:scale-110">
          <Download className="w-3 h-3" />
        </span>
      </span>
    </a>
  );
};

export default FloatingDownloadButton;
