# arbolito

arbolito is a lightweight React interface backed by the Express API in `../backend`. It lets you:

- Filter prospects by list, priority, status, and fuzzy name search.
- Scroll through paginated results (50 at a time, auto-load on scroll).
- Select rows to queue enrichment, mark outreach ready, or export a CSV.
- Inspect a full document in a slide-over drawer and deep-link to the Firestore console.

## Getting Started

```bash
cd prospect-ui
npm install
cp .env.example .env.local   # set VITE_API_BASE_URL (defaults to http://localhost:4000)
npm run dev
```

The app expects the following collections / fields to exist in Firestore (the backend reads them with the Admin SDK):

- `prospects` documents with fields such as `priority_bucket`, `enrichment.status`, `list_ids`, `emails`, `social.linkedin.primary`.
- `enrichment_lists` collection to populate the “Lists” filter dropdown (it reads both document IDs and `name` field).

### Environment variables

Only `VITE_API_BASE_URL` is required. Point it to wherever the backend is running.

## Backend Endpoints

The UI calls three routes exposed by the backend:

- `GET /api/prospects` – paginated list (supports `listIds`, `priorities`, `statuses`, `search`, `pageSize`, `pageToken` query params).
- `GET /api/list-options` – returns distinct `list_ids` values.
- `POST /api/enqueue_enrichment` – queue selected IDs for enrichment.
- `POST /api/tag_outreach_ready` – mark selected IDs ready for outreach.

If you deploy the backend somewhere else, update `VITE_API_BASE_URL` accordingly.

## Notes & Next Steps

- All Firestore reads go through the backend, so no Firebase client SDK/config is required.
- The backend still expects the appropriate indexes to exist in Firestore for the query combinations (list IDs, priorities, statuses).
- If you already maintain an `outreach_ready` boolean on the document, adapt `isOutreachReady` to use it instead of recomputing.

This project is a starting point—you can layer in authentication, more sophisticated error handling, or embed it in your existing portal. Let me know if you need help wiring the backend handlers or refining the filtering logic.
