# MrKapu Wall Service

Standalone Nest service for wall-related APIs.

## Included slices

- `wall` module
- wall schemas and DTOs
- circle/user/advertisement schemas required by wall ranking and ad placement
- shared auth, data-access, S3 upload, and domain-event helpers used by wall

## Expected environment variables

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_S3_PUBLIC_URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `EVENT_BUS_NAME`

## Notes

- `mrkapu-auth-service` does not open a MongoDB connection today.
- `mrkapu-wall-service` should use the same `MONGODB_URI` as the database that contains the shared `users`, `advertisementcampaigns`, `wallposts`, `wallviewevents`, `circles`, and `circleposts` collections.
- If you want wall and auth to share one `.env` value convention, keep the same variable name: `MONGODB_URI`.
