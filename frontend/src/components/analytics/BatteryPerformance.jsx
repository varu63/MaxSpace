import React from "react";
import {
  Battery,
  Zap,
  Gauge,
  CalendarDays,
} from "lucide-react";

const BatteryPerformance = ({ batteries }) => {
  return (
    <div className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[#16263A]">
          Battery Performance
        </h2>

        <p className="text-sm text-[#747B83]">
          Battery level and performance overview
        </p>
      </div>

      <div className="space-y-4">
        {batteries.length === 0 ? (
          <p className="text-center py-8 text-slate-400">
            No batteries available
          </p>
        ) : (
          batteries.map((battery, index) => {
            const batteryName =
              battery.name ||
              battery.batteryName ||
              `Battery ${index + 1}`;

            const health = Number(
              battery.stateOfHealth ??
                battery.health ??
                battery.healthPercentage ??
                0
            );

            const voltage = battery.voltage ?? "--";
            const capacity = battery.capacity ?? "--";

            return (
              <div
                key={battery.id || battery.batteryId || index}
                className="border border-slate-100 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#173B5C] flex items-center justify-center">
                      <Battery className="w-5 h-5 text-white" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {batteryName}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {battery.serialNumber ||
                          battery.batteryId ||
                          "No serial number"}
                      </p>
                    </div>
                  </div>

                  <span className="font-bold text-slate-900">
                    {health}%
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <Zap className="w-4 h-4 text-slate-600 mb-1" />

                    <p className="text-xs text-slate-400">
                      Voltage
                    </p>

                    <p className="text-sm font-semibold">
                      {voltage}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <Gauge className="w-4 h-4 text-slate-600 mb-1" />

                    <p className="text-xs text-slate-400">
                      Capacity
                    </p>

                    <p className="text-sm font-semibold">
                      {capacity}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <CalendarDays className="w-4 h-4 text-slate-600 mb-1" />

                    <p className="text-xs text-slate-400">
                      Services
                    </p>

                    <p className="text-sm font-semibold">
                      {battery.serviceCount ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BatteryPerformance;