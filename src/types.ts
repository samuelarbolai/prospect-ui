export interface Prospect {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role_title?: string | null;
  organization?: string | null;
  org_domain?: string | null;
  hlth_id?: string | null;
  list_ids?: string[];
  priority_bucket?: "P1" | "P2" | string | null;
  priority_reason?: string | null;
  priority_source?: string | null;
  enrichment?: {
    status?: "pending" | "queued" | "completed" | string | null;
    last_run_at?: string | null;
    version?: string | null;
    notes?: string | null;
    vertical?: string | null;
    keywords?: string | null;
    domain_status?: string | null;
    domain_run_id?: string | null;
  };
  emails?: { address?: string; label?: string; status?: string }[];
  social?: {
    linkedin?: {
      primary?: string | null;
      status?: string | null;
    };
  };
  import_metadata?: {
    source_file?: string | null;
    row_index?: number;
  };
  [key: string]: unknown;
}

export interface ProspectFilters {
  listIds: string[];
  priorities: string[];
  statuses: string[];
  searchName: string;
}
