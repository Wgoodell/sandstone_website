# Rolu to Website Workflow Notes

Goal: keep listing data fresh and keep lead delivery reliable.

## Environment Contract

- `SPARK_ACCESS_TOKEN`: primary server-only listings credential
- `MSL_FEED_URL`: optional fallback endpoint returning an array of listings
- `ROLU_WEBHOOK_URL`: backward-compatible contact webhook fallback
- `ROLU_WEBHOOK_CONTACT_URL`, `ROLU_WEBHOOK_SELL_URL`, `ROLU_WEBHOOK_RENT_URL`, `ROLU_WEBHOOK_JOIN_URL`: preferred form-specific lead webhooks

## Listings Source Order

1. Spark API via `SPARK_ACCESS_TOKEN`
2. Legacy `MSL_FEED_URL` JSON feed
3. Curated demo listings fallback

## Listing Feed Shape

The app normalizes each feed item into:

- `id` (required)
- `title` or `name`
- `location` or `address`
- `price` or `listPrice`
- `image.url` or `photo`
- optional: `beds`, `baths`, `sqft`, `featured`

If feed data is missing/unavailable, the app shows fallback demo listings.

## Recommended Rolu Listing Workflow

Use this only if you still need the legacy fallback feed during Spark rollout.

1. Trigger on listing create/update.
2. Send HTTP payload to your feed endpoint (`MSL_FEED_URL` destination).
3. Include normalized fields shown above.
4. Enable retry/backoff in Rolu.

Example payload template:

```json
{
  "id": "{{trigger.id}}",
  "title": "{{trigger.title || trigger.name}}",
  "location": "{{trigger.address}}",
  "price": "{{trigger.price}}",
  "image": { "url": "{{trigger.photo_url}}" },
  "beds": "{{trigger.beds}}",
  "baths": "{{trigger.baths}}",
  "sqft": "{{trigger.square_feet}}",
  "featured": "{{trigger.featured}}"
}
```

## Lead Webhook Notes

Contact form submissions send:

- `firstName`
- `lastName`
- `email`
- `phone`
- `message`

Validation happens server-side before webhook submission.

## Operational Checks

- If listings look stale, verify Spark credentials first, then `MSL_FEED_URL` if the legacy fallback is enabled.
- If form submissions fail, verify `ROLU_WEBHOOK_URL` and destination status.
- Keep listing images accessible over HTTPS for best compatibility.
