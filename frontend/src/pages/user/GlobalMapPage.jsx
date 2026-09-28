/* ============================================================
   GLOBAL MAP · user scope
   Shows ONLY the batteries the signed-in account owns (the backend
   enforces owner isolation — the map never displays other
   customers' locations). Popup opens the Battery Passport at
   /battery/:id.
   ============================================================ */
import { fetchUserMapBatteries, fetchUserOrganizations } from "../../services";
import FleetMapPage from "../../components/common/map/FleetMapPage";

const GlobalMapPage = () => (
  <FleetMapPage
    fetcher={fetchUserMapBatteries}
    organizationsFetcher={fetchUserOrganizations}
    title="Global Battery Map"
    subtitle="Your batteries on the map · compliance, health and lifecycle at a glance."
  />
);

export default GlobalMapPage;