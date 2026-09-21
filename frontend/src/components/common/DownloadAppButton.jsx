import { Download } from "lucide-react";
import { getStoreLink, isStoreLinkConfigured } from "./storeLinks";

const DownloadAppButton = ({
  className = "",
  iconClassName = "w-4 h-4",
  children = null,
}) => {
  const href = getStoreLink();

  if (!href && !isStoreLinkConfigured()) {
    return (
      <button
        type="button"
        className={className}
        title="Coming soon"
        aria-label="Download App"
      >
        <Download className={`shrink-0 ${iconClassName}`} />
        {children}
        <span className="sr-only">Coming soon</span>
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title="Download App"
      aria-label="Download App"
    >
      <Download className={`shrink-0 ${iconClassName}`} />
      {children}
    </a>
  );
};

export default DownloadAppButton;