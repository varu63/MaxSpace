const StatCard = ({
  icon: Icon,
  value,
  label,
  iconClass = "bg-[#173B5C]",
}) => {
  return (
    <div className="rounded-2xl bg-[#FFFDF8] border border-[#EEE9DA] p-6 shadow-sm">
      <div
        className={`w-12 h-12 rounded-full ${iconClass} flex items-center justify-center mb-5`}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>

      <div className="text-3xl font-bold text-[#16263A]">{value}</div>

      <div className="mt-1 text-sm text-[#68717B]">{label}</div>
    </div>
  );
};
export default StatCard