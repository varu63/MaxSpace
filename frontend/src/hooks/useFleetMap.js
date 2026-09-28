/* ============================================================
   USE FLEET MAP HOOK
   State machine shared by the map pages (user / admin; the
   battery-technician panel has no standalone map — its service
   location lives inside the assigned service details). The caller
   injects the role-scoped fetcher (fetchUserMapBatteries /
   fetchAdminMapBatteries) so the hook itself never decides which
   JWT to use.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { MAP_MAX_LIMIT } from "../components/common/map/mapConfig";

const EMPTY = { healthStatus: "", batteryStatus: "", complianceStatus: "", serviceStatus: "" };

export const useFleetMap = (fetcher) => {
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [mode, setMode] = useState("compliance");
  const [state, setState] = useState({ data: [], summary: null, loading: true, error: null });

  const loadedFiltersRef = useRef(EMPTY);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (f, term = submittedSearch) => {
      const id = ++requestIdRef.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetcher({
          page: 1,
          limit: MAP_MAX_LIMIT,
          search: term.trim(),
          ...f,
        });
        if (requestIdRef.current !== id) return;
        setState({ data: res?.data || [], summary: res?.summary || null, loading: false, error: null });
      } catch (err) {
        if (requestIdRef.current !== id) return;
        setState({ data: [], summary: null, loading: false, error: err });
      }
    },
    [fetcher, submittedSearch]
  );

  /* Initial load. */
  useEffect(() => {
    load(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Refetch whenever a filter value changes. The initial load above is
     not re-triggered here because the refs already match on mount. */
  useEffect(() => {
    if (JSON.stringify(filters) === JSON.stringify(loadedFiltersRef.current)) return;
    loadedFiltersRef.current = filters;
    load(filters);
  }, [filters, load]);

  const applySearch = useCallback(() => {
    setSubmittedSearch(search.trim());
    load(filters, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters]);

  const reset = useCallback(() => {
    setSearch("");
    setSubmittedSearch("");
    setFilters(EMPTY);
  }, []);

  const reload = useCallback(() => load(filters), [load, filters]);

  const onChangeFilter = useCallback((name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  return {
    ...state,
    filters,
    setFilters,
    search,
    setSearch,
    submittedSearch,
    mode,
    setMode,
    applySearch,
    reset,
    reload,
    onChangeFilter,
    hasFilters: JSON.stringify(filters) !== JSON.stringify(EMPTY) || submittedSearch.trim().length > 0,
  };
};