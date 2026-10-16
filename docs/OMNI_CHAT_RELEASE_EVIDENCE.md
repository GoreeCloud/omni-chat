# Omni Chat development release evidence

This document tracks release-blocking evidence for the draft development PR. It does not authorize promotion.

## Synthetic recovery

The `synthetic-recovery-smoke` GitHub Actions job exercises logical backup and restore with fresh, isolated MongoDB and PostgreSQL/pgvector containers. It verifies one synthetic MongoDB document and one restored vector row. No existing volumes, host ports, or real user data are part of this test. Its result is authoritative only for the exact GitHub commit that ran it.

Passing this test does **not** establish production backup or restore readiness. Existing-volume migration, rehearsal against an approved staging copy, retention and credential recovery, recovery-time objectives, and owner authorization remain separate release requirements.

## Supply-chain disposition

Mammoth 1.13.0 declares an old CLI-only `argparse@1.x` dependency, which pulled in vulnerable `sprintf-js` and previously produced three moderate production findings. An **isolated fresh-install compatibility test** demonstrated that npm can resolve the scoped `mammoth > argparse@^2.0.1` override without `sprintf-js`; both Mammoth library DOCX-to-HTML and CLI DOCX-to-Markdown conversion passed (the legacy CLI printed nonfatal deprecation warnings). The Omni Chat lockfile now uses root `argparse@2.0.1` with no nested parser or `sprintf-js`. `npm audit --omit=dev --audit-level=moderate` reports **zero advisories locally**, and the foundation CI gate has been tightened to block moderate-or-higher findings.

**Limitations:** A full local monorepo `npm ci` was terminated with exit code 137, so the complete clean-install compatibility has not been verified locally. The exact-head GitHub Actions dependency installation, document conversion suites and broader regression checks must pass before treating this remediation as release-accepted. Do not suppress or waive advisories, and continue tracking Mammoth upstream's CLI migration.

## Release decision

**NO-GO** pending exact-head full end-to-end CI, authenticated and device qualification, approved staging migration and recovery, dependency review, full downstream Glaze qualification, and explicit owner release authorization.
