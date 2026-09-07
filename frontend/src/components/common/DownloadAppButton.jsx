import { Download } from "lucide-react";
import { getStoreLink } from "./storeLinks";

const DownloadAppButton = ({
  className = "",
  iconClassName = "w-4 h-4",
  children = null,
}) => {
  return (
    <a
      href={getStoreLink()}
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
