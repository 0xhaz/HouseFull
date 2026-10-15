# Fixtures

Recorded Qloo responses live here **locally only**. This folder is gitignored because Qloo's hackathon terms forbid storing response data in a public repository.

- `probe/`: raw responses from `pnpm probe:qloo`
- Demo mode in production reads fixtures from the private `fixtures` table in Supabase, not from this folder.
- CI uses synthetic fixtures (made-up entities in Qloo's response shape) committed under `packages/qloo-client/test/fixtures/`.
