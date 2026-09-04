import React from "react";

const getHealthStyle = (health) => {
  if (health >= 80) {
    return "bg-green-100 text-green-700";
  }

  if (health >= 50) {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-red-100 text-red-700";
};

const AnalyticsTable = ({ batteries }) => {
  return (
    <div className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#ECE7DA]">
        <h2 className="text-lg font-bold text-[#16263A]">
          Battery Analysis
        </h2>

        <p className="text-sm text-[#747B83]">
          Detailed battery statistics
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#F7F3E9]">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold text-[#747B83] uppercase">
                Battery
              </th>

              <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                Health
              </th>

              <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                Voltage
              </th>

              <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                Capacity
              </th>

              <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                Services
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {batteries.map((battery, index) => {
              const health = Number(
                battery.stateOfHealth ??
                  battery.health ??
                  battery.healthPercentage ??
                  0
              );

              return (
                <tr
                  key={battery.id || battery.batteryId || index}
                  className="hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">
                      {battery.name ||
                        battery.batteryName ||
                        `Battery ${index + 1}`}
                    </div>

                    <div className="text-xs text-slate-400">
                      {battery.serialNumber ||
                        battery.batteryId ||
                        "--"}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getHealthStyle(
                        health
                      )}`}
                    >
                      {health}%
                    </span>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {battery.voltage ?? "--"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {battery.capacity ?? "--"}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                    {battery.serviceCount ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalyticsTable;