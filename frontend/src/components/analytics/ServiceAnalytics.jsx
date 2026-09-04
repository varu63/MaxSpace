import React from "react";
import {
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
    },
    {
      title: "Booked",
      value: booked,
      icon: Clock,
    },
    {
      title: "Completed",
      value: completed,
      icon: CheckCircle2,
    },
    {
      title: "Cancelled",
      value: cancelled,
      icon: XCircle,
    },
  ];

  return (
    <div className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[#16263A]">
          Service Analytics
        </h2>

        <p className="text-sm text-[#747B83]">
          Overview of your battery services
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-2xl bg-[#F5F1E7] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#173B5C] flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5 text-white" />
                </div>

                <div>
                  <p className="text-xs text-[#747B83]">
                    {item.title}
                  </p>

                  <p className="text-xl font-bold text-[#16263A]">
                    {item.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-500">
            Pending / Active
          </span>

          <span className="font-semibold text-slate-900">
            {pending}
          </span>
        </div>

        <div className="h-2 bg-slate-100 rounded-full">
          <div
            className="h-full bg-[#F4C430] rounded-full"
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
  );
};

export default ServiceAnalytics;