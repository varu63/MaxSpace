import { useMemo } from "react";
import {
  Battery,
  Wrench,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Home,
} from "lucide-react";
import BatteryCard from "../components/home/BatteryCard";
import {
  PageHeader,
  StatCard,
  Card,
  SectionHeader,
  IconBox,
} from "../components/common";
import { useBattery } from "../context/BatteryContext";

export default function HomePage() {
  const {
    batteries,
    stats,
    getBatteryServiceStatus,
  } = useBattery();

  const { activeServiceCount, pendingCount, healthyCount, needsAttention } = useMemo(() => {
    let active = 0;
    let pending = 0;
    let healthy = 0;
    let attention = 0;

    for (const b of batteries) {
      const health = Number(b.stateOfHealth);
      if (health >= 80) healthy += 1;
      else attention += 1;

      const status = getBatteryServiceStatus(b);
      if (status === "Active") active += 1;
      else if (status === "Pending") pending += 1;
    }

    return {
      activeServiceCount: active,
      pendingCount: pending,
      healthyCount: healthy,
      needsAttention: attention,
    };
  }, [batteries, getBatteryServiceStatus]);

  const fleetStats = useMemo(
    () => [
      { icon: CheckCircle2, label: "Healthy", value: healthyCount, iconTone: "primary" },
      { icon: Clock3, label: "Pending Service", value: pendingCount, iconTone: "accent" },
      { icon: Wrench, label: "Under Service", value: activeServiceCount, iconTone: "primary" },
    ],
    [healthyCount, pendingCount, activeServiceCount]
  );

  return (
    <div className="w-full space-y-8">
      <PageHeader
        icon={Home}
        title="Good Morning"
        subtitle="Here's an overview of your battery fleet."
        actions={
          <span className="hidden md:inline-flex items-center gap-2 text-sm text-[#747B83]">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Live
          </span>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard icon={Battery} value={stats.totalBatteries} label="Total Batteries" />
        <StatCard icon={Wrench} value={activeServiceCount} label="Active Service" />
        <StatCard icon={ShieldCheck} value={stats.activeWarranties} label="Warranty Active" />
        <StatCard icon={AlertTriangle} value={needsAttention} label="Needs Attention" tone="accent" />
      </section>

      <Card>
        <SectionHeader
          icon={Battery}
          title="Fleet Status"
          subtitle="Current condition of your battery fleet"
          right={
            <button className="flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:text-[#102F4A] transition">
              View Analytics
              <ChevronRight className="w-4 h-4" />
            </button>
          }
        />

        <div className="p-6 lg:p-7 grid grid-cols-1 md:grid-cols-3 gap-5">
          {fleetStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-5"
            >
              <IconBox icon={stat.icon} tone={stat.iconTone} />
              <div>
                <p className="text-xs text-[#747B83]">{stat.label}</p>
                <p className="text-xl font-bold text-[#16263A]">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#16263A]">
              Your Batteries
            </h2>
            <p className="mt-1 text-sm text-[#747B83]">
              Manage and monitor your registered batteries
            </p>
          </div>

          <button className="flex items-center gap-1 text-sm font-bold text-[#747B83] hover:text-[#173B5C] transition">
            See All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {batteries.map((battery) => (
            <BatteryCard key={battery.id} battery={battery} />
          ))}
        </div>
      </section>
    </div>
  );
}
