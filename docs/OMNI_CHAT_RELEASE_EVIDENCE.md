# Omni Chat development release evidence

This document tracks release-blocking evidence for the draft development PR. It does not authorize promotion.

## Synthetic recovery

The `synthetic-recovery-smoke` GitHub Actions job exercises logical backup and restore with fresh, isolated MongoDB and PostgreSQL/pgvector containers. It verifies one synthetic MongoDB document and one restored vector row. No existing volumes, host ports, or real user data are part of this test. Its result is authoritative only for the exact GitHub commit that ran it.

Passing this test does **not** establish production backup or restore readiness. Existing-volume migration, rehearsal against an approved staging copy, retention and credential recovery, recovery-time objectives, and owner authorization remain separate release requirements.

## Supply-chain disposition

The source dependency `mammoth@1.13.0` retains `argparse@1.x` and `sprintf-js`, causing three moderate npm audit findings. No patched `sprintf-js` version is published. The real document conversion unit tests have passed, but those tests do not eliminate the advisory. Do not suppress these advisories or report an all-clear; resolve the upstream dependency, replace it with a reviewed compatible alternative, or secure formal risk acceptance before release.

## Release decision

**NO-GO** pending exact-head full end-to-end CI, authenticated and device qualification, approved staging migration and recovery, dependency review, full downstream Glaze qualification, and explicit owner release authorization.
