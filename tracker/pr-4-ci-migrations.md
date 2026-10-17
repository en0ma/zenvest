# PR 4 — Protected GitHub Actions database migrations

## Objective
Run pending Prisma migrations on the hosted PostgreSQL database through CI after verification, with least-privilege protected GitHub environment secrets.

## Requirement matrix
| Requirement | Code | Verification | Status |
|---|---|---|---|
| PR builds do not use prod secrets | .github/workflows/ci.yml | code review, workflow event guards | implemented, CI pending |
| Main only migrates after tests | .github/workflows/ci.yml | inspect needs/ref guard | implemented, CI pending |
| Secret from GitHub Actions environment | production-db environment, DATABASE_URL | runtime integration | external setup pending |
| Migration status and serialization | .github/workflows/ci.yml | workflow validation and real migration run | external setup pending |
| Operational setup and caveats | docs/github-actions-migrations.md | documentation review | implemented |

## Audit and risks
- Existing Next.js/Prisma app uses `prisma migrate deploy`, but previous CI only validated schema against a dummy URL.
- Vercel automatically deploys main independently; does **not** wait for post-merge migrations.
- Workflow cannot create or prove the hosted GitHub environment DATABASE_URL secret using available GitHub access.
- PostgreSQL direct connectivity from GitHub-hosted runners and database backups require operator verification.
- Existing migration files remain unchanged.
- No production database has been modified.

## Follow-up
Merge after CI and review. Configure protected production-db environment with required reviewers and main branch restriction; set DATABASE_URL secret; migrate staging first and check migration job on main. For reliable app-before/after migration ordering, configure Vercel deployment checks or promotion gates.
