/* ============================================================
   ADMIN MAP PAGE
   Whole-fleet map (markers include the linked owner for admins)
   plus the Location Manager where real battery locations are
   recorded, moved and untracked. Admin JWTs go through the
   backend's requireAdmin guard for every map call.
   ============================================================ */
import { fetchAdminMapBatteries, fetchAdminOrganizations } from "../../services";
import FleetMapPage from "../../components/common/map/FleetMapPage";
import LocationManager from "../../components/admin/map/LocationManager";

const AdminMapPage = () => (
  <FleetMapPage
    fetcher={fetchAdminMapBatteries}
    organizationsFetcher={fetchAdminOrganizations}
    title="Fleet Map"
    subtitle="Whole-fleet locations with compliance, health and lifecycle · owner shown for admins."
    passportHref={() => null}
  >
    {({ reload }) => (
      <LocationManager onChanged={reload} />
    )}
  </FleetMapPage>
);

export default AdminMapPage;