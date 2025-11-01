import { useEffect, useMemo, useRef, useState } from "react";
import { CSVLink } from "react-csv";
import { Prospect, ProspectFilters } from "./types";
import { useProspects } from "./hooks/useProspects";
import { useListOptions } from "./hooks/useListOptions";
import { useLists } from "./hooks/useLists";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const INITIAL_FILTERS: ProspectFilters = {
  listIds: [],
  priorities: [],
  statuses: [],
  searchName: "",
};

const PRIORITY_OPTIONS = ["P1", "P2"];
const STATUS_OPTIONS = ["pending", "queued", "completed"];
const CREATE_NEW_LIST_ID = "__new__";

function isOutreachReady(row: Prospect): boolean {
  const priorityValid = row.priority_bucket === "P1" || row.priority_bucket === "P2";
  const enriched = row.enrichment?.status === "completed";
  const hasEmail = (row.emails ?? []).some((item) => item.address && item.address.length > 3);
  return priorityValid && enriched && hasEmail;
}

function sortStrings(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function arraysHaveSameItems(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = sortStrings(a);
  const sortedB = sortStrings(b);
  return sortedA.every((value, index) => value === sortedB[index]);
}

export default function App() {
  const [draftFilters, setDraftFilters] = useState<ProspectFilters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ProspectFilters>(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerProspect, setDrawerProspect] = useState<Prospect | null>(null);
  const [heroOpen, setHeroOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalMode, setListModalMode] = useState<"add" | "view">("add");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [listModalError, setListModalError] = useState<string | null>(null);
  const [autoListSelection, setAutoListSelection] = useState(false);
  const tableSentinelRef = useRef<HTMLDivElement | null>(null);

  const { options: listOptions } = useListOptions();
  const { prospects, loading, error, hasMore, loadMore, refresh } = useProspects(appliedFilters);
  const {
    lists,
    loading: listsLoading,
    error: listsError,
    refresh: refreshLists,
    createList,
    addProspectsToList,
  } = useLists();

  const readyCount = useMemo(
    () => prospects.filter((row) => isOutreachReady(row)).length,
    [prospects],
  );

  const selectedRows = useMemo(
    () => prospects.filter((row) => selectedIds.has(row.id)),
    [prospects, selectedIds],
  );

  const filtersDirty = useMemo(
    () =>
      !arraysHaveSameItems(draftFilters.listIds, appliedFilters.listIds) ||
      !arraysHaveSameItems(draftFilters.priorities, appliedFilters.priorities) ||
      !arraysHaveSameItems(draftFilters.statuses, appliedFilters.statuses) ||
      draftFilters.searchName !== appliedFilters.searchName,
    [draftFilters, appliedFilters],
  );

  const activeList = useMemo(
    () => (activeListId ? lists.find((item) => item.id === activeListId) ?? null : null),
    [lists, activeListId],
  );
  const listViewActive = useMemo(
    () => activeListId !== null && appliedFilters.listIds.length === 1 && appliedFilters.listIds[0] === activeListId,
    [activeListId, appliedFilters.listIds],
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAutoListSelection(false);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(prospects.map((row) => row.id)));
      setAutoListSelection(true);
    } else {
      setSelectedIds(new Set());
      setAutoListSelection(false);
    }
  };

  const applyFilters = (next: ProspectFilters, autoSelect = false) => {
    const normalized: ProspectFilters = {
      listIds: sortStrings(next.listIds),
      priorities: sortStrings(next.priorities),
      statuses: sortStrings(next.statuses),
      searchName: next.searchName,
    };
    setDraftFilters(normalized);
    setAppliedFilters(normalized);
    setSelectedIds(new Set());
    setAutoListSelection(autoSelect);
  };

  const handleApplyFilters = () => {
    applyFilters(draftFilters, false);
  };

  const openAddToListModal = async () => {
    if (selectedIds.size === 0) {
      alert("Select at least one prospect to add to a list.");
      return;
    }
    setListModalMode("add");
    setListModalError(null);
    setNewListName("");
    await refreshLists();
    setListModalOpen(true);
  };

  const openViewListModal = async () => {
    if (lists.length === 0) {
      await refreshLists();
    }
    if (lists.length === 0 && !listsLoading) {
      alert("No lists available yet. Add prospects to a list first.");
      return;
    }
    setListModalMode("view");
    setListModalError(null);
    setNewListName("");
    await refreshLists();
    setListModalOpen(true);
  };

  const closeListModal = () => {
    setListModalOpen(false);
    setListModalError(null);
    setNewListName("");
  };

  const handleListModalConfirm = async () => {
    try {
      setListModalError(null);
      if (listModalMode === "add") {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) {
          setListModalError("Select prospects before adding to a list.");
          return;
        }

        let targetListId = selectedListId;
        if (!targetListId || targetListId === CREATE_NEW_LIST_ID) {
          const trimmedName = newListName.trim();
          if (!trimmedName) {
            setListModalError("Enter a name for the new list.");
            return;
          }
          const created = await createList(trimmedName);
          targetListId = created.id;
          setSelectedListId(created.id);
        }

        const { added, alreadyPresent } = await addProspectsToList(targetListId, ids);
        await refreshLists();
        setActiveListId(targetListId);
        closeListModal();
        alert(
          `List updated. Added ${added} prospect${added === 1 ? "" : "s"}${
            alreadyPresent > 0 ? ` (${alreadyPresent} already present)` : ""
          }.`,
        );
      } else {
        if (!selectedListId) {
          setListModalError("Choose a list to view.");
          return;
        }
        const nextFilters: ProspectFilters = {
          listIds: [selectedListId],
          priorities: [],
          statuses: [],
          searchName: "",
        };
        setActiveListId(selectedListId);
        applyFilters(nextFilters, true);
        closeListModal();
      }
    } catch (err) {
      console.error(err);
      setListModalError(err instanceof Error ? err.message : "Unable to update list. Try again.");
    }
  };

  const handleQueueEnrichment = async () => {
    if (targetIds.length === 0) {
      alert("Select at least one prospect or pick a list containing prospects.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/enqueue_enrichment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: targetIds }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSelectedIds(new Set());
      setAutoListSelection(listViewActive);
      refresh();
      alert("Enrichment queued successfully.");
    } catch (err) {
      console.error(err);
      alert("Unable to queue enrichment. Check console for details.");
    }
  };

  const handleMarkReady = async () => {
    if (targetIds.length === 0) {
      alert("Select at least one prospect or pick a list containing prospects.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/tag_outreach_ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: targetIds }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSelectedIds(new Set());
      setAutoListSelection(listViewActive);
      refresh();
      alert("Prospects tagged as outreach ready.");
    } catch (err) {
      console.error(err);
      alert("Unable to tag outreach ready. Check console for details.");
    }
  };

  const handleInfiniteScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 50 && !loading && hasMore) {
      loadMore();
    }
  };

  const totalCount = prospects.length;
  const selectedCount = selectedIds.size > 0 ? selectedIds.size : listViewActive && autoListSelection ? prospects.length : 0;
  const queuedCount = prospects.filter((row) => row.enrichment?.status === "queued").length;

  const targetIds = useMemo(() => {
    if (selectedIds.size > 0) {
      return Array.from(selectedIds);
    }
    if (listViewActive && autoListSelection) {
      return prospects.map((row) => row.id);
    }
    return [] as string[];
  }, [selectedIds, listViewActive, autoListSelection, prospects]);

  const canRunBulkActions = selectedIds.size > 0 || (listViewActive && autoListSelection && prospects.length > 0);

  const exportRows = useMemo(() => {
    if (selectedIds.size > 0) {
      return selectedRows;
    }
    if (listViewActive && autoListSelection) {
      return prospects;
    }
    return [] as Prospect[];
  }, [selectedRows, selectedIds, listViewActive, autoListSelection, prospects]);

  const exportData = useMemo(
    () =>
      exportRows.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        organization: row.organization ?? "",
        role_title: row.role_title ?? "",
        priority_bucket: row.priority_bucket ?? "",
        priority_reason: row.priority_reason ?? "",
        enrichment_status: row.enrichment?.status ?? "",
        linkedin: row.social?.linkedin?.primary ?? "",
        email: row.emails?.[0]?.address ?? "",
      })),
    [exportRows],
  );

  useEffect(() => {
    if (!listModalOpen) return;
    if (listModalMode === "add") {
      if (lists.length === 0) {
        setSelectedListId(CREATE_NEW_LIST_ID);
      } else if (!selectedListId || (selectedListId !== CREATE_NEW_LIST_ID && !lists.some((list) => list.id === selectedListId))) {
        setSelectedListId(lists[0].id);
      }
    } else if (listModalMode === "view") {
      if (lists.length === 0) {
        setSelectedListId("");
      } else if (!selectedListId || !lists.some((list) => list.id === selectedListId)) {
        setSelectedListId(activeListId ?? lists[0].id);
      }
    }
  }, [listModalOpen, listModalMode, lists, selectedListId, activeListId]);

  useEffect(() => {
    if (listViewActive) {
      setSelectedIds(new Set(prospects.map((row) => row.id)));
      setAutoListSelection(true);
    }
  }, [listViewActive, prospects]);

  useEffect(() => {
    if (activeListId && !appliedFilters.listIds.includes(activeListId)) {
      setActiveListId(null);
    }
  }, [activeListId, appliedFilters.listIds]);

  useEffect(() => {
    if (!listViewActive) {
      setAutoListSelection(false);
    }
  }, [listViewActive]);

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

                <div className="list-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={openAddToListModal}
                    disabled={selectedIds.size === 0}
                  >
                    Add to list
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={openViewListModal}
                    disabled={(lists.length === 0 && !listsLoading) || listsLoading}
                  >
                    View list
                  </button>
                  {listViewActive && activeList && (
                    <span className="current-list-pill">Viewing: {activeList.name}</span>
                  )}
                  {listsError && !listsLoading && (
                    <span className="list-error">{listsError}</span>
                  )}
                </div>

                <div className="actions">
                  <button
                    className="primary"
                    disabled={!canRunBulkActions}
                    onClick={handleQueueEnrichment}
                  >
                    Run enrichment
                  </button>
                  <button
                    className="secondary"
                    disabled={!canRunBulkActions}
                    onClick={handleMarkReady}
                  >
                    Tag outreach ready
                  </button>
                  <CSVLink
                    className="secondary"
                    data={exportData}
                    filename="prospects_export.csv"
                    onClick={() => {
                      if (exportRows.length === 0) {
                        alert("Select at least one row or view a list with prospects before exporting.");
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

      {listModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>{listModalMode === "add" ? "Add prospects to a list" : "View a list"}</h3>
            {listModalMode === "add" ? (
              <>
                {listsLoading ? (
                  <p>Loading lists…</p>
                ) : (
                  <label className="modal-field">
                    <span>Select a list</span>
                    <select
                      value={selectedListId}
                      onChange={(event) => {
                        const value = event.target.value || CREATE_NEW_LIST_ID;
                        setSelectedListId(value);
                      }}
                    >
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} {list.prospectCount ? `(${list.prospectCount})` : ""}
                        </option>
                      ))}
                      <option value={CREATE_NEW_LIST_ID}>Create new list…</option>
                    </select>
                  </label>
                )}
                {(selectedListId === CREATE_NEW_LIST_ID || lists.length === 0) && (
                  <label className="modal-field">
                    <span>New list name</span>
                    <input
                      type="text"
                      value={newListName}
                      onChange={(event) => setNewListName(event.target.value)}
                      placeholder="e.g. ICP - High intent"
                    />
                  </label>
                )}
                <p className="modal-hint">
                  {selectedIds.size} prospect{selectedIds.size === 1 ? "" : "s"} selected.
                </p>
              </>
            ) : (
              <>
                {listsLoading ? (
                  <p>Loading lists…</p>
                ) : (
                  <label className="modal-field">
                    <span>Select a list to view</span>
                    <select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)}>
                      <option value="">Select a list</option>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} {list.prospectCount ? `(${list.prospectCount})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {listModalError && <p className="modal-error">{listModalError}</p>}
            {listsError && !listsLoading && <p className="modal-error subtle">{listsError}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={closeListModal}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleListModalConfirm}
                disabled={listModalMode === "view" && (!selectedListId || selectedListId === CREATE_NEW_LIST_ID)}
              >
                {listModalMode === "add" ? "Save list" : "Open list"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
