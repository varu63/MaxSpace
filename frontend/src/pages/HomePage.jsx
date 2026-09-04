import {
  Battery,
  Wrench,
  ShieldCheck,
  ChevronRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import BatteryCard from "../components/home/BatteryCard";
import StatCard from "../components/home/StatCards";

const batteries = [
  {
    id: "MVBE0000871",
    model: "ESS",
    chemistry: "LFP",
    cells: 4,
    status: "FG PENDING",
    statusType: "pending",
    health: 0,
  },
  {
    id: "MVAE0014036",
    model: "ESS",
    chemistry: "LFP",
    cells: 4,
    status: "FG PENDING",
    statusType: "pending",
    health: 0,
  },
  {
    id: "MVAE0014037",
    model: "ESS",
    chemistry: "LFP",
    cells: 4,
    status: "FG PENDING",
    statusType: "pending",
    health: 0,
  },
  {
    id: "MVAE0014038",
    model: "ESS",
    chemistry: "LFP",
    cells: 4,
    status: "FG PENDING",
    statusType: "pending",
    health: 0,
  },
];





export default function HomePage() {
  return (
    <div className="w-full space-y-8">
          {/* Welcome */}
          <section className="mb-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-medium text-[#8A7A4A] mb-2">
                  Dashboard Overview
                </p>

                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
                  Good Morning
                </h2>

                <p className="mt-2 text-[#69717A]">
                  Here's an overview of your battery fleet.
                </p>
              </div>

              <div className="hidden md:flex items-center gap-2 text-sm text-[#69717A]">
                <Activity className="w-4 h-4" />
                Last updated just now
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
            <StatCard
              icon={Battery}
              value="5"
              label="Total Batteries"
            />

            <StatCard
              icon={Wrench}
              value="0"
              label="Active Service"
            />

            <StatCard
              icon={ShieldCheck}
              value="0"
              label="Warranty Active"
            />

            <StatCard
              icon={AlertTriangle}
              value="5"
              label="Needs Attention"
              iconClass="bg-[#B48611]"
            />
          </section>

          {/* Fleet Status */}
          <section className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-6 lg:p-7 mb-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <h3 className="text-xl font-bold">
                  Fleet Status
                </h3>
                <p className="text-sm text-[#737983] mt-1">
                  Current condition of your battery fleet
                </p>
              </div>

              <button className="flex items-center gap-2 text-sm font-semibold text-[#173B5C]">
                View Analytics
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
              <div className="flex items-center gap-4 rounded-2xl bg-[#F5F1E7] p-5">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#173B5C]" />
                </div>

                <div>
                  <p className="text-xs text-[#777D83]">Healthy</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-[#F5F1E7] p-5">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center">
                  <Clock3 className="w-5 h-5 text-[#B48611]" />
                </div>

                <div>
                  <p className="text-xs text-[#777D83]">Pending</p>
                  <p className="text-xl font-bold">5</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-[#F5F1E7] p-5">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-[#173B5C]" />
                </div>

                <div>
                  <p className="text-xs text-[#777D83]">Under Service</p>
                  <p className="text-xl font-bold">0</p>
                </div>
              </div>
            </div>
          </section>

          {/* Batteries */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold">
                  Your Batteries
                </h2>
                <p className="mt-1 text-sm text-[#737983]">
                  Manage and monitor your registered batteries
                </p>
              </div>

              <button className="flex items-center gap-1 text-sm font-bold text-[#59616A] hover:text-[#173B5C]">
                See All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {batteries.map((battery) => (
                <BatteryCard
                  key={battery.id}
                  battery={battery}
                />

              ))}
            </div>
          </section>
    </div>
  );
}