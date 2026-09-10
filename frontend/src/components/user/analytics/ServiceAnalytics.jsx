import React from "react";
import {
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";
import { Card, SectionHeader } from "../common";

const ServiceAnalytics = ({ bookings }) => {
  const total = bookings.length;

  const booked = bookings.filter(
    (item) => item.status === "Booked"
  ).length;

  const completed = bookings.filter(
    (item) => item.status === "Completed"
  ).length;

  const cancelled = bookings.filter(
    (item) => item.status === "Cancelled"
  ).length;

  const pending = bookings.filter(
    (item) =>
      item.status !== "Completed" &&
      item.status !== "Cancelled"
  ).length;

  const stats = [
    {
      title: "Total Services",
      value: total,
      icon: Wrench,
      tone: "primary",
    },
    {
      title: "Booked",
      value: booked,
      icon: Clock,
      tone: "accent",
    },
    {
      title: "Completed",
      value: completed,
      icon: CheckCircle2,
      tone: "primary",
    },
    {
      title: "Cancelled",
      value: cancelled,
      icon: XCircle,
      tone: "accent",
    },
  ];

  return (
    <Card padded={false}>
      <SectionHeader
        icon={Activity}
        title="Service Analytics"
        subtitle="Overview of your battery services"
      />

      <div className="p-6">
        {/* Service Stats */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4"
              >
                {/* Text - Left */}
                <div className="min-w-0">
                  <p className="text-xs text-[#747B83]">
                    {item.title}
                  </p>

                  <p className="text-xl font-bold text-[#16263A]">
                    {item.value}
                  </p>
                </div>

                {/* Icon - Right */}
                <div
                  className={`w-10 h-10 rounded-xl ${
                    item.tone === "accent"
                      ? "bg-[#B48611]"
                      : "bg-[#173B5C]"
                  } flex items-center justify-center shadow-sm shrink-0 ml-3`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending / Active Progress */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#747B83]">
              Pending / Active
            </span>

            <span className="font-semibold text-[#16263A]">
              {pending}
            </span>
          </div>

          <div className="h-2 bg-[#F5F1E7] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B48611] rounded-full transition-all duration-300"
              style={{
                width:
                  total > 0
                    ? `${(pending / total) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default React.memo(ServiceAnalytics);

