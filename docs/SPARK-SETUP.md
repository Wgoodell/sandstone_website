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
SPARK_API_MY_LISTINGS_PATH=/v1/my/listings
SPARK_PAGE_SIZE=25
SPARK_ACTIVE_LISTINGS_FILTER=MlsStatus Eq 'Active'
```

Optional:

```bash
SPARK_MY_LISTINGS_FILTER=MlsStatus Eq 'Active'
MSL_FEED_URL=https://example.com/legacy-listings-feed
```

## Implementation Notes

- The app sends the token in the `Authorization` header from the server.
- `/listings` paginates through all active listings from Spark because standard Spark requests cap `_limit` per page.
- The home page uses Spark `my/listings` for the carousel.
- If Spark is unavailable, the app can fall back to `MSL_FEED_URL`.
- Listing payloads are normalized into the internal `PropertyCard` contract before reaching the UI.
- Spark-hosted photo URLs are normalized to `https` when possible.
