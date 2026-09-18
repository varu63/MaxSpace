import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import BatteryCard from "../../components/user/home/BatteryCard";
import {
  PageHeader,
  StatCard,
  Card,
  SectionHeader,
  IconBox,
  FAQ,
  Pagination,
} from "../../components/common";
import { useBattery } from "../../context/BatteryContext";
import { fetchBatteriesPaginated } from "../../services/api";

export default function HomePage() {
  const navigate = useNavigate();
  const {
    batteries,
    stats,
    getBatteryServiceStatus,
  } = useBattery();

  const [pageBatteries, setPageBatteries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [fetching, setFetching] = useState(false);

  /* Server-side battery page for the "Your Batteries" grid; the fleet stats
     above keep using the context list (the backend still honors the legacy
     full-array call) so the dashboard is consistent regardless of page. */
  const fetchPage = async (nextPage = 1) => {
    setFetching(true);
    try {
      const result = await fetchBatteriesPaginated({ page: nextPage, limit: 6 });
      setPageBatteries(result.data || []);
      setPagination(result.pagination || null);
    } catch {
      // The fleet stats above still render from the context list; a failed
      // page load simply leaves the grid at its current contents.
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (nextPage) => fetchPage(nextPage);

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
      { icon: CheckCircle2, label: "Healthy", value: healthyCount, iconTone: "primary" , iconRight: true},
      { icon: Clock3, label: "Pending Service", value: pendingCount, iconTone: "accent" , iconRight: true},
      { icon: Wrench, label: "Under Service", value: activeServiceCount, iconTone: "primary", iconRight: true },
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
            <button
              onClick={() => navigate("/analytics")}
              className="flex items-center gap-2 text-sm font-semibold text-[#173B5C] hover:text-[#102F4A] transition"
            >
              View Analytics
              <ChevronRight className="w-4 h-4" />
            </button>
          }
        />

        <div className="p-6 lg:p-7 flex flex-col lg:flex-row gap-6 items-center">
  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
    {fleetStats.map((stat) => (
      <div
        key={stat.label}
        className="flex items-center justify-between rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-5"
      >
        {/* Text - Left */}
        <div>
          <p className="text-xs text-[#747B83]">
            {stat.label}
          </p>

          <p className="text-xl font-bold text-[#16263A]">
            {stat.value}
          </p>
        </div>

        {/* Icon - Right */}
        <IconBox
          icon={stat.icon}
          tone={stat.iconTone}
        />
      </div>
    ))}
  </div>
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

          <button
            onClick={() => navigate("/analytics")}
            className="flex items-center gap-1 text-sm font-bold text-[#747B83] hover:text-[#173B5C] transition"
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pageBatteries.map((battery) => (
            <BatteryCard key={battery.id} battery={battery} />
          ))}
        </div>

        <div className="mt-6">
          <Pagination pagination={pagination} onPageChange={handlePageChange} />
          {fetching && (
            <p className="text-xs text-[#8A9096] mt-2">Loading more batteries…</p>
          )}
        </div>
      </section>

      <FAQ />
    </div>
  );
}
