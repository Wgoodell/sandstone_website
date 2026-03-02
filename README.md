# Sandstone Real Estate Group Website

Next.js 15 (App Router) marketing website for Sandstone Real Estate Group.

## Overview

The site is a brand-forward real estate experience with:

- Responsive landing page (desktop + mobile)
- Searchable listings feed with dynamic detail pages
- Lead capture form wired to Rolu webhook
- View-only Privacy Policy and Terms pages

Core design direction is defined by brand tokens in `src/app/globals.css` and Montserrat loaded in `src/app/layout.tsx`.

## Tech Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- Zod validation
- Framer Motion (contact animations)
- Mammoth (DOCX to HTML conversion for legal docs)

## Architecture

The project is organized by responsibility:

- `src/app`: routes and page composition
- `src/components`: UI sections and reusable components
- `src/actions`: server actions (orchestration only)
- `src/services`: external I/O (Spark listings, legacy feed fallback, lead webhook)
- `src/schemas`: validation contracts
- `src/config`: env accessors
- `src/lib`: pure helpers/utilities
- `src/types`: shared domain types
- `src/constants`: static copy/links

### SOLID in practice

- **Single Responsibility:** each layer has one job (validation vs I/O vs composition).
- **Open/Closed:** new CRM integrations or listing data sources can be added without rewriting UI components.
- **Liskov Substitution:** any implementation of `ILeadSubmissionService` can replace the default one.
- **Interface Segregation:** small focused types (`LeadInput`, `SubmitLeadState`, `PropertyCard`).
- **Dependency Inversion:** server action depends on service interface + config functions, not direct env/fetch logic.

## Routes

- `/`: home page
- `/listings`: all listings, optional `?search=` filter
- `/listings/[id]`: listing details
- `/sell`: service stub page
- `/rent`: service stub page
- `/join`: recruiting stub page
- `/privacy-policy`: view-only legal page
- `/terms-and-conditions`: view-only legal page

## Home Page Composition

`src/app/page.tsx` composes:

1. `SiteHeader`
2. `HeroSection` (search input)
3. `FeaturedListingsSection` (first 4 filtered listings)
4. `PrimaryActionTiles`
5. `AboutSection`
6. `ContactForm`
7. `SiteFooter`

## Listings Flow

1. `fetchPropertyCards()` in `src/services/listings.service.ts` tries Spark first.
2. `fetchSparkPropertyCards()` in `src/services/spark.service.ts` calls the Spark listings endpoint with a server-only bearer token.
3. If Spark is not configured or fails, the app falls back to the legacy `MSL_FEED_URL` JSON feed.
4. If neither source is available, curated demo listings keep the UI hydrated.
5. `filterPropertyCards()` in `src/lib/properties.ts` applies search query filtering.
6. Cards link into `/listings/[id]` detail pages.

## Lead Form Flow

1. User submits `ContactForm`.
2. `submitLead` server action validates input using `LeadSchema`.
3. Action reads the form-specific Rolu webhook URL from config.
4. `leadSubmissionService.submit(...)` posts payload to webhook.
5. UI shows success/error + field errors.

## Environment Variables

- `SPARK_ACCESS_TOKEN`: preferred server-only Spark access token
- `SPARK_API_BASE_URL`: optional override, defaults to `https://sparkapi.com`
- `SPARK_API_LISTINGS_PATH`: optional override, defaults to `/v1/listings`
- `SPARK_LISTINGS_FILTER`: optional Spark `_filter` expression such as `ListStatus Eq 'Active'`
- `SPARK_LISTINGS_LIMIT`: optional max listings to request, defaults to `24`
- `ROLU_WEBHOOK_URL`: backward-compatible contact webhook fallback
- `ROLU_WEBHOOK_CONTACT_URL`, `ROLU_WEBHOOK_SELL_URL`, `ROLU_WEBHOOK_RENT_URL`, `ROLU_WEBHOOK_JOIN_URL`: preferred lead webhook envs
- `TURNSTILE_SECRET_KEY`: required for server-side captcha verification
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: required for the Turnstile widget
- `MSL_FEED_URL`: optional legacy listings feed fallback

## Spark Setup

Spark access should be provisioned from the Spark dashboard as documented at [Set Up Access](https://sparkplatform.com/docs/overview/set_up_access). The current app expects the access token to be stored only in a server env var (`SPARK_ACCESS_TOKEN`) and sends it from the server in the `Authorization` header when requesting listings.

Recommended rollout:

1. Request Spark API access for the correct MLS/account from the Spark dashboard.
2. Copy the issued access token/API key into `SPARK_ACCESS_TOKEN` in your deployment environment.
3. Keep the token server-only. Do not expose it with a `NEXT_PUBLIC_` prefix and do not call Spark directly from client components.
4. Set `SPARK_LISTINGS_FILTER` if your MLS requires narrowing to active listings or a specific office/agent slice.
5. Leave `MSL_FEED_URL` unset once Spark is validated, or keep it temporarily as a fallback during cutover.

## Local Development

```bash
npm install
npm run dev
```

Build and checks:

```bash
npm run lint
npm run build
```

## Project Structure

```text
src/
├── actions/
│   └── submit-lead.ts
├── app/
│   ├── globals.css
│   ├── join/page.tsx
│   ├── layout.tsx
│   ├── listings/
│   │   ├── [id]/page.tsx
│   │   └── page.tsx
│   ├── page.tsx
│   ├── privacy-policy/page.tsx
│   ├── rent/page.tsx
│   ├── sell/page.tsx
│   └── terms-and-conditions/page.tsx
├── components/
│   ├── properties/
│   │   ├── index.ts
│   │   └── ListingCard.tsx
│   ├── sections/
│   │   ├── AboutSection.tsx
│   │   ├── FeaturedListingsSection.tsx
│   │   └── PrimaryActionTiles.tsx
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   └── textarea.tsx
│   ├── ContactForm.tsx
│   ├── HeroSection.tsx
│   ├── LegalDocumentLayout.tsx
│   ├── MobileMenuPortal.tsx
│   ├── SiteFooter.tsx
│   ├── SiteHeader.tsx
├── config/
│   ├── env.ts
│   └── index.ts
├── constants/
│   ├── index.ts
│   └── site.ts
├── lib/
│   ├── index.ts
│   ├── properties.ts
│   ├── utils.ts
│   └── zod.ts
├── schemas/
│   ├── index.ts
│   └── lead.ts
├── services/
│   ├── index.ts
│   ├── lead.service.ts
│   ├── listings.service.ts
│   ├── msl.service.ts
│   └── spark.service.ts
└── types/
    ├── index.ts
    ├── lead.ts
    └── property.ts
```

## Additional Docs

- `docs/ARCHITECTURE.md`
- `docs/ROLU-WORKFLOW.md`
- `docs/SPARK-SETUP.md`
