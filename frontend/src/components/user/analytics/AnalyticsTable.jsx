import React from "react";
import { BarChart3 } from "lucide-react";
import { Card, SectionHeader } from "../../common";

const getHealthStyle = (health) => {
  if (health >= 80) {
    return "bg-green-100 text-green-700";
  }

  if (health >= 50) {
    return "bg-[#FBF1C9] text-[#A77A08]";
  }

  return "bg-red-100 text-red-700";
};

const AnalyticsTable = ({ batteries }) => {
  return (
    <Card padded={false}>
      <SectionHeader
        icon={BarChart3}
        title="Battery Analysis"
        subtitle="Detailed battery statistics"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#F5F1E7]">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-[#747B83] uppercase">
                Battery
              </th>

              <th className="px-6 py-4 text-xs font-semibold text-[#747B83] uppercase">
                Health
              </th>

              <th className="px-6 py-4 text-xs font-semibold text-[#747B83] uppercase">
                Voltage
              </th>

              <th className="px-6 py-4 text-xs font-semibold text-[#747B83] uppercase">
                Capacity
              </th>

              <th className="px-6 py-4 text-xs font-semibold text-[#747B83] uppercase">
                Services
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#EEE9DA]">
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
                  className="hover:bg-[#F5F1E7] transition"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#16263A]">
                      {battery.name ||
                        battery.modelName ||
                        battery.batteryName ||
                        `Battery ${index + 1}`}
                    </div>

                    <div className="text-xs text-[#8A9096]">
                      {battery.serialNumber ||
                        battery.batteryId ||
                        battery.id ||
                        "--"}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getHealthStyle(
                        health
                      )}`}
                    >
                      {health}%
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-[#747B83]">
                    {battery.voltage ?? "--"}
                  </td>

                  <td className="px-6 py-4 text-sm text-[#747B83]">
                    {battery.capacity ?? "--"}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-[#16263A]">
                    {battery.serviceCount ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default React.memo(AnalyticsTable);

