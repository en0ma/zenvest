# Database migrations in GitHub Actions

Production PostgreSQL migrations run with `npx prisma migrate deploy` **after** the test/typecheck/build job passes, and **only** on pushes to `main`. PRs and feature branch pushes run checks but never access the production database secret.

## One-time GitHub configuration

1. In GitHub repository Settings → Secrets and variables → Actions, add a **repository secret** named `DATABASE_URL`. Copy the PostgreSQL connection URL from the hosted database's *direct/migration* connection settings (not necessarily the serverless pooled URL used by Vercel runtime). Use a dedicated migrator role with only the needed schema DDL rights; do not reuse admin/superuser credentials. If the provider requires TLS, configure its recommended `sslmode` and certificates.
2. Keep Vercel project's `DATABASE_URL` separately set to the provider's recommended runtime pooled connection string. Never put database credentials into source code or CI logs.
3. Verify the hosted PostgreSQL firewall allows GitHub-hosted runners, or use a network-restricted self-hosted runner if it does not. Avoid permanently opening database access just for CI.

## Execution

On merging a PR into `main`, GitHub Actions:
- runs `verify` with a dummy schema-validation URL, builds and unit-tests the app;
- installs Prisma, checks that `DATABASE_URL` is set;
- executes `npx prisma migrate deploy` and `npx prisma migrate status`.

Prisma records applied migrations in `_prisma_migrations`, so a repeat run does not reapply completed migrations. GitHub Actions concurrency prevents overlapping migration jobs.

## Important deployment ordering

Vercel's Git integration independently builds/ships `main` on push; **this workflow alone does not delay Vercel production release until migrations finish**. For schema changes, use backward-compatible expand/contract migrations and configure Vercel Deployment Checks or gated deployment promotion to ensure the application is not released ahead of the database migration. Do not assume GitHub branch protections enforce post-merge DB migrations.

The first migration execution against a new database creates application tables; it has not been run by this PR. Review the schema changes, make a backup/snapshot, and use a staging database before first production application.

## Recovery
If the migration job fails, inspect GitHub Actions logs *without printing credentials*, fix the root cause, then rerun the job. Never casually delete `_prisma_migrations`, reset a live database, or rewrite an already applied migration. Coordinate a Prisma migration recovery procedure for partial failures.

**Repository-secret configuration:** The owner opted out of a GitHub Environment. This means the main-branch migration job runs automatically after CI succeeds, without an environment reviewer gate. Protect the `main` branch and require code review and successful CI before merge. Never expose the secret to pull requests; the workflow's migration job has an explicit main-branch push guard.
