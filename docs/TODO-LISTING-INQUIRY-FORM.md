# TODO: Listing Inquiry Form

## Decision Summary

We should implement our own listing-specific contact form inside each property detail page.

Reasoning:

- The current app already has a working lead pipeline based on server actions plus Rolu webhooks.
- Spark is currently being used as a listings data source, not as a hosted lead form provider.
- Spark documentation exposes API resources such as listing data and contacts, but it does not give this custom site a ready-made "contact agent about this property" UI that we can drop into the page.

Practical conclusion:

- Build the inquiry form in this app.
- Send submissions through the existing lead submission workflow first.
- Optionally add Spark contact creation later if the brokerage wants Spark/Flexmls-side CRM sync.

## Current Codebase Touchpoints

- Listing detail page: `src/app/listings/[id]/page.tsx`
- Shared lead form UI: `src/components/LeadCaptureSection.tsx`
- Contact form wrapper: `src/components/ContactForm.tsx`
- Lead server action: `src/actions/submit-lead.ts`
- Lead payload builder: `src/lib/lead-payload.ts`
- Lead types: `src/types/lead.ts`
- Lead validation schema: `src/schemas/lead.ts`
- Lead webhook routing: `src/config/env.ts`

## Product Requirements

- Add a visible inquiry form on each listing detail page.
- The form must clearly identify the property being inquired about.
- Submission payload must include listing-specific metadata so the agent knows which home the lead came from.
- Keep captcha protection and SMS consent handling consistent with the rest of the site.
- Reuse the current CRM/webhook delivery path unless the business explicitly asks for a Spark-side contact sync.

## Payload Requirements

At minimum, every listing inquiry should include:

- listing route id
- MLS number
- listing title/address
- listing URL
- asking price
- user first name
- user last name
- user email
- user phone
- user message
- transactional SMS opt-in
- marketing SMS opt-in

Recommended optional fields:

- preferred contact method
- preferred showing time
- financing status

## Implementation Plan

### 1. Add a new lead form variant

- Introduce a new `LeadFormType`, likely `listingInquiry`.
- Update `src/types/lead.ts` to support a listing-specific webhook payload.
- Add a dedicated env var such as `ROLU_WEBHOOK_LISTING_INQUIRY_URL`.
- Update `getLeadWebhookUrl(...)` in `src/config/env.ts`.

### 2. Extend the lead schema and server action

- Decide which listing fields are hidden system fields versus user-editable fields.
- Update `src/schemas/lead.ts` if new user-entered fields are added.
- Update `submitLeadForForm(...)` in `src/actions/submit-lead.ts` to read listing metadata from `FormData`.
- Validate that listing id, listing URL, and MLS number are present for the inquiry form.

### 3. Extend webhook payload generation

- Update `src/lib/lead-payload.ts` so listing inquiry submissions include property context.
- Ensure payload shape is explicit and stable.
- Confirm with CRM/Rolu what field names they expect for property-specific leads.

### 4. Reuse the existing form UI

- Reuse `LeadCaptureSection` if possible instead of building a second form system.
- Add props to support:
  - hidden listing metadata fields
  - listing-specific heading/subheading
  - a shorter CTA such as `Request Info` or `Schedule a Tour`
  - optional showing-intent copy
- Keep Turnstile and success/error handling identical to existing forms.

### 5. Embed the form on listing pages

- Add the inquiry form to `src/app/listings/[id]/page.tsx`.
- Pre-fill hidden context from the loaded `PropertyDetail`.
- Show the listing title/address near the form so users know what they are submitting about.
- Keep the current `Schedule a tour` CTA only if it complements the form; otherwise replace it with the embedded form.

### 6. Decide CRM routing

- Preferred: a dedicated listing inquiry webhook so these leads do not get mixed with generic contact leads.
- Fallback: reuse `ROLU_WEBHOOK_CONTACT_URL` temporarily if the CRM team cannot create a dedicated endpoint yet.
- Confirm who receives these leads and how listing context is surfaced in their workflow.

### 7. Optional Spark/Flexmls integration

- Evaluate whether leads should also be written to Spark Contacts in addition to the current CRM webhook.
- Do this only if there is a clear business need for Spark/Flexmls-side follow-up workflows.
- Treat Spark contact sync as a second phase, not a blocker for the first release.

## UX Notes

- Form heading should be specific, for example: `Interested in this property?`
- Default message placeholder should mention showings/questions/offers.
- Success message should confirm the inquiry is tied to the selected listing.
- On mobile, place the form high enough on the page that it is discoverable without excessive scrolling.

## Acceptance Criteria

- A user can open any listing detail page and submit an inquiry for that specific property.
- The submission reaches the configured webhook successfully.
- The webhook payload contains enough property context for the receiving agent to identify the listing immediately.
- Captcha and consent handling work exactly as they do for the existing forms.
- Validation errors, loading states, and success states behave consistently with the current site.

## QA Checklist

- Submit a valid inquiry from a live listing.
- Confirm the received payload contains the correct listing id, MLS number, title, URL, and price.
- Confirm a submission from one listing cannot accidentally carry metadata from a previously viewed listing.
- Test mobile and desktop layouts.
- Test with missing captcha, missing required fields, and webhook failure.

## Open Questions

- Does the brokerage want a dedicated webhook/workflow for listing inquiries?
- Which property fields does the CRM team want attached to each lead?
- Should the CTA be framed as `Request Info`, `Schedule a Tour`, or both?
- Do we need to support appointment scheduling, or only lead capture for now?

## Recommended Delivery Order

1. Add `listingInquiry` form type and payload support.
2. Reuse `LeadCaptureSection` on the listing detail page.
3. Wire a dedicated webhook env var.
4. QA one real listing end-to-end.
5. Decide whether Spark Contacts integration is needed as a later phase.

## References

- Spark Overview: https://sparkplatform.com/docs/overview
- Spark Contacts API: https://sparkplatform.com/docs/services/contacts
- Internal lead pipeline: `src/actions/submit-lead.ts`, `src/lib/lead-payload.ts`, `src/components/LeadCaptureSection.tsx`
