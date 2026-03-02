# Architecture & Design Principles

This codebase is structured for a clean, maintainable marketing site with clear boundaries between UI, validation, and integrations.

## Layer Responsibilities

- `app/`: route-level composition and page metadata
- `components/`: presentational sections and reusable UI blocks
- `actions/`: server-side orchestration (validation + service invocation)
- `schemas/`: Zod contracts
- `services/`: external I/O adapters (Spark listings, legacy feed fallback, Rolu webhook)
- `config/`: environment access
- `lib/`: pure helper functions
- `types/`: shared domain contracts
- `constants/`: static copy and links

## SOLID Mapping

| Principle | Current implementation |
|---|---|
| Single Responsibility | `submit-lead.ts` orchestrates; `lead.service.ts` performs network I/O; `lead.ts` schema validates; UI components render only. |
| Open/Closed | New CRM = new `ILeadSubmissionService` implementation; listing data source can change without rewriting listing components. |
| Liskov Substitution | Any `ILeadSubmissionService` implementation can replace `leadSubmissionService`. |
| Interface Segregation | Contracts are small: `LeadInput`, `SubmitLeadState`, `PropertyCard`, `LeadSubmissionResult`. |
| Dependency Inversion | Server action depends on config/services abstractions, not raw `process.env` calls spread across app code. |

## Patterns in Use

- **Service abstraction:** lead submission is encapsulated behind `ILeadSubmissionService`.
- **Data normalization at boundaries:** `spark.service.ts` maps Spark listing payloads into the internal `PropertyCard` shape.
- **Pure filtering helper:** listing search lives in `lib/properties.ts` (`filterPropertyCards`) so pages remain composition-focused.
- **Section composition:** pages compose sections; sections consume typed props.

## Current App Flow

### Home (`/`)

1. Fetch listings from `fetchPropertyCards()`.
2. Try Spark API first, then legacy `MSL_FEED_URL`, then demo fallback data.
3. Apply query filtering through `filterPropertyCards()`.
4. Render hero, featured cards (first 4), action tiles, about, contact, footer.

### Listings (`/listings`)

1. Fetch listings from the same service.
2. Apply `?search=` query filter.
3. Render full results grid via reusable `ListingCard`.

### Listing Detail (`/listings/[id]`)

1. Fetch normalized cards.
2. Find by id.
3. Render detail view or `notFound()`.

### Lead Submission

1. `ContactForm` submits to `submitLead` server action.
2. Action validates via `LeadSchema`.
3. Action retrieves the form-specific Rolu webhook URL from config.
4. Action calls `leadSubmissionService.submit(...)`.

## Folder Structure

```text
src/
├── actions/
├── app/
├── components/
│   ├── properties/
│   ├── sections/
│   └── ui/
├── config/
├── constants/
├── lib/
├── schemas/
├── services/
└── types/
```

## Extension Guidelines

### Add a New CRM

1. Create a new service implementing `ILeadSubmissionService`.
2. Select implementation in action/config.
3. Keep form/action contracts unchanged.

### Add a New Listings Source

1. Return normalized `PropertyCard[]` from a new service/provider.
2. Keep UI consuming `PropertyCard[]` only.
3. Reuse `filterPropertyCards()` for search behavior.
