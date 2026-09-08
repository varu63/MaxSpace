import { statusStyle } from "./adminUtils";

const StatusBadge = ({ status }) => {
  const { chip, dot } = statusStyle(status);
  return (
    <span className={`chip border ${chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
};

export default StatusBadge;