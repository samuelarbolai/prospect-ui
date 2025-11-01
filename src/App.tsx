import { useEffect, useMemo, useRef, useState } from "react";
import { CSVLink } from "react-csv";
import { Prospect, ProspectFilters } from "./types";
import { useProspects } from "./hooks/useProspects";
import { useListOptions } from "./hooks/useListOptions";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const INITIAL_FILTERS: ProspectFilters = {
  listIds: [],
  priorities: [],
  statuses: [],
  searchName: "",
};

const PRIORITY_OPTIONS = ["P1", "P2"];
const STATUS_OPTIONS = ["pending", "queued", "completed"];

function isOutreachReady(row: Prospect): boolean {
  const priorityValid = row.priority_bucket === "P1" || row.priority_bucket === "P2";
  const enriched = row.enrichment?.status === "completed";
  const hasEmail = (row.emails ?? []).some((item) => item.address && item.address.length > 3);
  return priorityValid && enriched && hasEmail;
}

export default function App() {
  const [draftFilters, setDraftFilters] = useState<ProspectFilters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ProspectFilters>(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerProspect, setDrawerProspect] = useState<Prospect | null>(null);
  const [heroOpen, setHeroOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [tableExpanded, setTableExpanded] = useState(false);
  const tableSentinelRef = useRef<HTMLDivElement | null>(null);

  const { options: listOptions } = useListOptions();
  const { prospects, loading, error, hasMore, loadMore, refresh } = useProspects(appliedFilters);

  const readyCount = useMemo(
    () => prospects.filter((row) => isOutreachReady(row)).length,
    [prospects],
  );

  const selectedRows = useMemo(
    () => prospects.filter((row) => selectedIds.has(row.id)),
    [prospects, selectedIds],
  );

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  const filtersDirty = useMemo(
    () =>
      !arraysEqual(draftFilters.listIds, appliedFilters.listIds) ||
      !arraysEqual(draftFilters.priorities, appliedFilters.priorities) ||
      !arraysEqual(draftFilters.statuses, appliedFilters.statuses) ||
      draftFilters.searchName !== appliedFilters.searchName,
    [draftFilters, appliedFilters],
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(prospects.map((row) => row.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      listIds: [...draftFilters.listIds],
      priorities: [...draftFilters.priorities],
      statuses: [...draftFilters.statuses],
      searchName: draftFilters.searchName,
    });
    setSelectedIds(new Set());
  };

  const handleQueueEnrichment = async () => {
    if (selectedIds.size === 0) return;
    try {
      const response = await fetch(`${API_BASE}/api/enqueue_enrichment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: Array.from(selectedIds) }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSelectedIds(new Set());
      refresh();
      alert("Enrichment queued successfully.");
    } catch (err) {
      console.error(err);
      alert("Unable to queue enrichment. Check console for details.");
    }
  };

  const handleMarkReady = async () => {
    if (selectedIds.size === 0) return;
    try {
      const response = await fetch(`${API_BASE}/api/tag_outreach_ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: Array.from(selectedIds) }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSelectedIds(new Set());
      refresh();
      alert("Prospects tagged as outreach ready.");
    } catch (err) {
      console.error(err);
      alert("Unable to tag outreach ready. Check console for details.");
    }
  };

  const exportData = selectedRows.map((row) => ({
    id: row.id,
    name: row.name ?? "",
    organization: row.organization ?? "",
    role_title: row.role_title ?? "",
    priority_bucket: row.priority_bucket ?? "",
    priority_reason: row.priority_reason ?? "",
    enrichment_status: row.enrichment?.status ?? "",
    linkedin: row.social?.linkedin?.primary ?? "",
    email: row.emails?.[0]?.address ?? "",
  }));

  const handleInfiniteScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 50 && !loading && hasMore) {
      loadMore();
    }
  };

  const totalCount = prospects.length;
  const selectedCount = selectedIds.size;
  const queuedCount = prospects.filter((row) => row.enrichment?.status === "queued").length;

  useEffect(() => {
    const sentinel = tableSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setTableExpanded((prev) => {
          const shouldExpand = !entry.isIntersecting;
          return prev === shouldExpand ? prev : shouldExpand;
        });
      },
      {
        threshold: 0,
        rootMargin: "-12px 0px 0px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark">AL</div>
          <h1>Aurora Leadflow</h1>
        </div>
        <div className="top-actions">
          <span className="workspace-tag">LeadGen Workspace</span>
        </div>
      </header>

      <main>
        <section className={`hero ${heroOpen ? "" : "collapsed"}`}>
          <div className="hero-header">
            <div className="hero-title">
              <h2>Pipeline Control Center</h2>
              {heroOpen && (
                <p>
                  Prioritize prospects across outreach stages, trigger enrichment, and keep Firestore aligned—all in one
                  calm workspace.
                </p>
              )}
            </div>
            <button
              className="collapse-btn"
              type="button"
              onClick={() => setHeroOpen((prev) => !prev)}
              aria-expanded={heroOpen}
            >
              {heroOpen ? "Hide overview" : "Show overview"}
            </button>
          </div>
          {heroOpen && (
            <div className="hero-body">
              <div className="summary-cards">
                <div className="summary-card">
                  <span>Visible prospects</span>
                  <strong>{totalCount}</strong>
                </div>
                <div className="summary-card">
                  <span>Outreach ready</span>
                  <strong>{readyCount}</strong>
                </div>
                <div className="summary-card">
                  <span>Queued for enrichment</span>
                  <strong>{queuedCount}</strong>
                </div>
                <div className="summary-card">
                  <span>Selected now</span>
                  <strong>{selectedCount}</strong>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="panel-stack">
          <div className={`filter-panel ${filtersOpen ? "" : "collapsed"}`}>
            <div className="panel-header">
              <h3>Filters</h3>
              <button
                className="collapse-btn"
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                aria-expanded={filtersOpen}
              >
                {filtersOpen ? "Hide filters" : "Show filters"}
              </button>
            </div>
            {filtersOpen && (
              <>
                <div className="filter-row">
                  <div className="filter-input">
                    <label htmlFor="list-filter">Lists</label>
                    <select
                      id="list-filter"
                      multiple
                      value={draftFilters.listIds}
                      onChange={(event) => {
                        const values = Array.from(event.target.selectedOptions, (opt) => opt.value);
                        setDraftFilters((prev) => ({ ...prev, listIds: values }));
                      }}
                    >
                      {listOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-input">
                    <label htmlFor="priority-filter">Priority</label>
                    <select
                      id="priority-filter"
                      multiple
                      value={draftFilters.priorities}
                      onChange={(event) => {
                        const values = Array.from(event.target.selectedOptions, (opt) => opt.value);
                        setDraftFilters((prev) => ({ ...prev, priorities: values }));
                      }}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-input">
                    <label htmlFor="status-filter">Status</label>
                    <select
                      id="status-filter"
                      multiple
                      value={draftFilters.statuses}
                      onChange={(event) => {
                        const values = Array.from(event.target.selectedOptions, (opt) => opt.value);
                        setDraftFilters((prev) => ({ ...prev, statuses: values }));
                      }}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                </div>

                <div className="filter-input">
                  <label htmlFor="search-filter">Search</label>
                  <input
                      id="search-filter"
                      type="search"
                      placeholder="Name, organization, or title"
                      value={draftFilters.searchName}
                      onChange={(event) =>
                        setDraftFilters((prev) => ({ ...prev, searchName: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="filter-actions">
                  <button
                    type="button"
                    className="secondary refresh-button"
                    onClick={handleApplyFilters}
                    disabled={loading}
                  >
                    Refresh results
                  </button>
                  {filtersDirty && (
                    <span className="filter-hint">Filters updated—click refresh to apply.</span>
                  )}
                </div>

                <div className="actions">
                  <button
                    className="primary"
                    disabled={selectedIds.size === 0}
                    onClick={handleQueueEnrichment}
                  >
                    Queue enrichment
                  </button>
                  <button
                    className="secondary"
                    disabled={selectedIds.size === 0}
                    onClick={handleMarkReady}
                  >
                    Tag outreach ready
                  </button>
                  <CSVLink
                    className="secondary"
                    data={exportData}
                    filename="prospects_export.csv"
                    onClick={() => {
                      if (selectedIds.size === 0) {
                        alert("Select at least one row to export.");
                        return false;
                      }
                      return true;
                    }}
                  >
                    Export selected
                  </CSVLink>
                </div>
              </>
            )}
          </div>
        </section>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <div ref={tableSentinelRef} className="table-sentinel" aria-hidden="true" />
        <section className={`table-card ${tableExpanded ? "expanded" : ""}`}>
          <div className="table-container" onScroll={handleInfiniteScroll}>
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === prospects.length}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                      aria-label="Select all"
                    />
                  </th>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>LinkedIn</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((row) => {
                  const status = row.enrichment?.status ?? "pending";
                  return (
                    <tr key={row.id} onClick={() => setDrawerProspect(row)}>
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelection(row.id)}
                          aria-label={`Select ${row.name ?? row.id}`}
                        />
                      </td>
                      <td>{row.name ?? "—"}</td>
                      <td>{row.organization ?? "—"}</td>
                      <td>{row.role_title ?? "—"}</td>
                      <td>{row.priority_bucket ?? "—"}</td>
                      <td>
                        <span className={`badge ${status}`}>{status}</span>
                      </td>
                      <td>
                        {row.social?.linkedin?.primary ? (
                          <a
                            href={row.social.linkedin.primary}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Profile
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{row.emails?.[0]?.address ?? "—"}</td>
                    </tr>
                  );
                })}
                {loading && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!hasMore && !loading && prospects.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                      No prospects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={`drawer ${drawerProspect ? "open" : ""}`}>
          {drawerProspect && (
            <>
              <header>
                <h2>{drawerProspect.name ?? "Prospect details"}</h2>
                <p>{drawerProspect.organization}</p>
              </header>
              <button
                className="secondary"
                onClick={() =>
                  window.open(
                    `https://console.cloud.google.com/firestore/data/panel/prospects/${drawerProspect.id}`,
                    "_blank",
                  )
                }
              >
                View in Firestore
              </button>
              <pre>{JSON.stringify(drawerProspect, null, 2)}</pre>
              <button className="secondary" onClick={() => setDrawerProspect(null)}>
                Close
              </button>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
