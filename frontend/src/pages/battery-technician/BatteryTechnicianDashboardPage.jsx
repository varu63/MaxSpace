import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  ClipboardList,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  User,
  MapPin,
  Calendar,
  Eye,
  ChevronRight,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { PageHeader, Card, StatCard, SectionHeader, EmptyState } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import StatusBadge from "../../components/admin/StatusBadge";
import { formatDate } from "../../components/admin/adminUtils";

/* Active services float to the top, completed/cancelled sink to the bottom. */
const SERVICE_PRIORITY = {
  "In Progress": 0,
  "On The Way": 1,
  "Accepted": 2,
  "Assigned": 3,
  "Upcoming": 4,
  "Waiting for Admin Approval": 5,
  "Completed": 6,
  "Cancelled": 7,
};

/* Small labelled info tile inside each assignment card. */
const InfoCell = ({ icon: Icon, label, value, sub, tone = "primary" }) => {
  const tones = {
    primary: "text-[#173B5C]",
    accent: "text-[#B48611]",
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F5F1E7] border border-[#E7E1D3] p-4 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${tones[tone]}`} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-[#747B83]">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-[#16263A] truncate">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-[#8A9096] truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
};

/* Individual service assignment card. */
const ServiceAssignmentCard = ({ service, onOpen }) => (
  <div className="rounded-3xl bg-[#FFFDF8] border border-[#EEE9DA] p-5 shadow-sm hover:shadow-md transition-shadow">
    {/* Top */}
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-full bg-[#173B5C] px-3 py-1 text-[10px] font-semibold text-white tracking-wide">
          {service.ticketNumber}
        </span>

        <h3 className="mt-2 text-lg font-bold text-[#16263A] truncate">
          {service.battery?.modelName || service.batteryName || "Battery"}
        </h3>

        <p className="text-[11px] text-[#8A9096] font-mono truncate">
          Battery ID · {service.batteryId}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <StatusBadge status={service.status} />

        <p className="mt-1.5 text-[10px] text-[#8A9096]">
          Request ID · {service.id}
        </p>
      </div>
    </div>

    {/* Information */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
      <InfoCell
        icon={User}
        label="Customer"
        value={service.customer?.name || "—"}
      />

      <InfoCell
        icon={MapPin}
        label="Service Location"
        value={service.center || service.battery?.location || "—"}
        tone="accent"
      />

      <InfoCell
        icon={Wrench}
        label="Service Type"
        value={service.serviceType}
      />

      <InfoCell
        icon={Calendar}
        label="Scheduled"
        value={formatDate(service.scheduledDate)}
        sub={service.scheduledTime}
        tone="accent"
      />
    </div>

    {/* Action */}
    <button
      type="button"
      onClick={onOpen}
      className="w-full mt-4 h-10 rounded-xl bg-[#173B5C] text-white text-xs font-semibold hover:bg-[#102F4A] transition"
    >
      <span className="flex items-center justify-center gap-1.5">
        <Eye className="w-3.5 h-3.5" />
        View Details
      </span>
    </button>
  </div>
);

const BatteryTechnicianDashboardPage = () => {
  const { services, stats, loading } = useBatteryTechnician();
  const navigate = useNavigate();
  const activeCount = useMemo(
    () =>
      services.filter((s) => ["On The Way", "In Progress"].includes(s.status)).length,
    [services]
  );

  const needsAttention = useMemo(
    () =>
      services.filter((s) => ["Assigned", "Waiting for Admin Approval"].includes(s.status)).length,
    [services]
  );

  const sortedServices = useMemo(
    () =>
      [...services].sort(
        (a, b) => (SERVICE_PRIORITY[a.status] ?? 99) - (SERVICE_PRIORITY[b.status] ?? 99)
      ),
    [services]
  );

  if (loading && services.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="w-full space-y-8">
      <PageHeader
        icon={Home}
        title="Good Morning"
        subtitle="Here's an overview of your service assignments and field operations."
        actions={
          <span className="hidden md:inline-flex items-center gap-2 text-sm text-[#747B83]">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Live
          </span>
        }
      />

      {/* Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          icon={ClipboardList}
          value={stats.total}
          label="Assigned Services"
        />
        <StatCard
          icon={PlayCircle}
          value={activeCount}
          label="Active Services"
        />
        <StatCard
          icon={CheckCircle2}
          value={stats.completed}
          label="Completed Services"
        />
        <StatCard
          icon={AlertTriangle}
          value={needsAttention}
          label="Needs Attention"
          tone="accent"
        />
      </section>

      {/* Recent Service Assignments */}
      <Card padded={false} className="overflow-hidden">
        <SectionHeader
          icon={ClipboardList}
          title="Recent Service Assignments"
          subtitle="Your prioritized queue of active and upcoming field operations"
          right={
            <Link
              to="/battery-technician/services"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#173B5C] hover:text-[#102F4A] transition"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          }
        />

        {sortedServices.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No Assigned Services"
            description="You don't have any services assigned yet. New bookings assigned to you will appear here."
          />
        ) : (
          <div className="p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedServices.map((service) => (
              <ServiceAssignmentCard
                key={service.id}
                service={service}
                onOpen={() =>
                  navigate(`/battery-technician/services/${service.id}`)
                }
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default BatteryTechnicianDashboardPage;