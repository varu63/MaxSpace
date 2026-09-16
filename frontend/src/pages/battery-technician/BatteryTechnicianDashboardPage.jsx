import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  ClipboardList,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ChevronRight,
} from "lucide-react";

import { useBatteryTechnician } from "../../context/BatteryTechnicianContext";
import { PageHeader, Card, StatCard, SectionHeader, EmptyState } from "../../components/common";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ServiceAssignmentCard from "../../components/battery-technician/ServiceAssignmentCard";

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