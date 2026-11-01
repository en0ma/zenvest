# Vercel deployment trigger check

This harmless documentation-only change verifies that merging a GitHub pull request into `main` triggers a new Vercel production deployment.

Expected behavior: Vercel creates a production deployment whose Git commit SHA matches this pull request's squash merge commit.

This file has no effect on application behavior, configuration, or database schema.
