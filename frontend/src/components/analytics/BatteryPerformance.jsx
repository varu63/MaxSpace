import React from "react";
import {
  Battery,
  Zap,
  Gauge,
  CalendarDays,
} from "lucide-react";
import { Card, SectionHeader } from "../common";

const BatteryPerformance = ({ batteries }) => {
  return (
    <Card padded={false}>
      <SectionHeader
        icon={Battery}
        title="Battery Performance"
        subtitle="Battery level and performance overview"
      />

      <div className="p-6 space-y-4">
        {batteries.length === 0 ? (
          <p className="text-center py-8 text-[#747B83]">
            No batteries available
          </p>
        ) : (
          batteries.map((battery, index) => {
            const batteryName =
              battery.name ||
              battery.modelName ||
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
                className="border border-[#E7E1D3] rounded-2xl p-4 bg-[#FFFDF8]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#173B5C] flex items-center justify-center">
                      <Battery className="w-5 h-5 text-white" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-[#16263A]">
                        {batteryName}
                      </h3>

                      <p className="text-xs text-[#747B83]">
                        {battery.serialNumber ||
                          battery.batteryId ||
                          "No serial number"}
                      </p>
                    </div>
                  </div>

                  <span className="font-bold text-[#16263A]">
                    {health}%
                  </span>
                </div>

<div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 bg-[#F5F1E7] border border-[#E7E1D3] rounded-xl p-3 min-w-0">
                    <Zap className="w-4 h-4 text-[#173B5C] shrink-0" />

                    <div className="min-w-0">
                      <p className="text-xs text-[#747B83]">
                        Voltage
                      </p>

                      <p className="text-sm font-semibold text-[#16263A] truncate">
                        {voltage}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-[#F5F1E7] border border-[#E7E1D3] rounded-xl p-3 min-w-0">
                    <Gauge className="w-4 h-4 text-[#173B5C] shrink-0" />

                    <div className="min-w-0">
                      <p className="text-xs text-[#747B83]">
                        Capacity
                      </p>

                      <p className="text-sm font-semibold text-[#16263A] truncate">
                        {capacity}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-[#F5F1E7] border border-[#E7E1D3] rounded-xl p-3 min-w-0">
                    <CalendarDays className="w-4 h-4 text-[#B48611] shrink-0" />

                    <div className="min-w-0">
                      <p className="text-xs text-[#747B83]">
                        Services
                      </p>

                      <p className="text-sm font-semibold text-[#16263A] truncate">
                        {battery.serviceCount ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default React.memo(BatteryPerformance);

