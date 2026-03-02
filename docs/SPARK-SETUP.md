# Spark API Setup

This app now uses Spark as the primary listings source.

## Reference

Start with Spark's current access setup guide:

- [Set Up Access](https://sparkplatform.com/docs/overview/set_up_access)
- [Access Token](https://sparkplatform.com/docs/authentication/access_token)

## Secure Configuration

1. Request Spark API access for the correct MLS/account in the Spark dashboard.
2. Copy the issued access token into the server-only `SPARK_ACCESS_TOKEN` environment variable.
3. Do not expose the token in any `NEXT_PUBLIC_` variable and do not call Spark from client components.
4. Keep requests server-side through `src/services/spark.service.ts`.

## Required App Environment

```bash
SPARK_ACCESS_TOKEN=your_server_only_token
SPARK_API_BASE_URL=https://sparkapi.com
SPARK_API_LISTINGS_PATH=/v1/listings
SPARK_LISTINGS_LIMIT=24
```

Optional:

```bash
SPARK_LISTINGS_FILTER=ListStatus Eq 'Active'
MSL_FEED_URL=https://example.com/legacy-listings-feed
```

## Implementation Notes

- The app sends the token in the `Authorization` header from the server.
- Spark is tried first for listings. If Spark is unavailable, the app can fall back to `MSL_FEED_URL`.
- Listing payloads are normalized into the internal `PropertyCard` contract before reaching the UI.
- Spark-hosted photo URLs are normalized to `https` when possible.
