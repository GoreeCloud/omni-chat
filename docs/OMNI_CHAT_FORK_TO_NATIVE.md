# Omni Chat — maintained Fork-to-Native implementation record

**Product owner:** GoreeCloud
**Authority:** https://github.com/GoreeCloud/omni-chat
**Development stage:** Initial source and identity integration
**Release:** Not production-qualified / not Native-complete

## Provenance
- Source project: https://github.com/LibreChat-AI/LibreChat
- Upstream source license: MIT. Preserve upstream LICENSE and third-party licenses.
- Baseline imported upstream commit: e1dfc10449ff713faffacd60273fddcfe2c0a698.
- Upstream remote: https://github.com/LibreChat-AI/LibreChat.git.
- This source started as a GitHub fork so inherited commit history and upstream lineage remain verifiable.
- Product and release decisions are governed by GoreeCloud and require independent acceptance.

## Current implemented increment
The original conversation engine, model-provider integrations, client navigation, sessions, storage and deployment stack are retained. This initial increment introduces an Omni Chat browser shell and document title, server/client fallback names, source-built Docker Compose development overlay, owned brand assets, and upstream revision observability. It also removes the upstream Help URL from the new default environment template.

Existing deployments may have stored settings and overridden environment variables. Do not assume they will automatically migrate or be rebranded.

For new development databases, the updated Compose overlay requires MongoDB credentials and enables `mongod --auth`. It also replaces the inherited PostgreSQL/pgvector sample password with a required unique `OMNI_POSTGRES_PASSWORD`, passed consistently to the RAG service through its documented `POSTGRES_PASSWORD` environment variable. Both databases require fresh volumes or a reviewed backup/credential migration. A no-containers-started Compose configuration check in CI verifies the **effective merged configuration** with synthetic credentials. This is not a production security qualification.

## Native interfaces and transition plan
1. **Identity and presentation:** owned configuration, product naming, logo family, onboarding and locale strings.
2. **Glaze design:** use the currently qualified Stable Glaze design system across navigation, conversations, overlays, empty and error states, responsive/mobile behavior, contrast themes, focus order and keyboard workflows.
3. **AI provider boundary:** GoreeCloud-owned contracts for model selection, chat messages, attachment and tool invocation with compatibility adapters.
4. **Data boundary:** controlled conversation/export/import/retention/delete contracts and migration testing.
5. **Security and identity:** review passkeys, SSO, multi-tenancy, authorization, session handling, secret protection, telemetry and abuse prevention.
6. **Operations:** reproducible builds, dependency and license scanning, deployment isolation, automated tests, backups, restore and rollback evidence.

These are targets, not claims of implemented native replacements.

## Selective upstream maintenance
The upstream-status workflow records whether upstream main matches this fork's checkout SHA. Divergence alone is not a security issue or automatic merge order; review upstream commits, release notes, licenses, threat and compatibility impact, then import a scoped, tested update as a GoreeCloud change. Do not overwrite the local product identity, merge unreviewed code, or automatically deploy upstream.

## Production dependency advisory baseline — October 16, 2026
A local npm production-dependency audit of the inherited initial lockfile returned 16 advisories (2 critical, 4 high, 4 moderate, 6 low). A non-force npm package-lock-only update reduced the follow-up audit to 10 (0 critical, 0 high, 4 moderate, 6 low). The lockfile update is a **development candidate**, not accepted release evidence. It changes thousands of lockfile lines and needs exact-head CI, integration checks, and review for dependency regressions. A new GitHub Actions production audit gate fails when any high or critical advisory is detected. Remaining moderate and low advisories require review and documented disposition. An advisory result does not alone prove exploitability or non-exploitability.

## October 16 hardening and regression evidence

The non-production Compose override now requires a unique, explicit PostgreSQL/pgvector password and propagates the same database name, username and password into RAG API. A newly configured CI job will test its effective merged configuration without launching containers or using production credentials on a GitHub Actions runner. **Local Docker Compose execution is unavailable on the development laptop**, and neither data-volume migration nor live RAG connectivity has been verified.

The MCP transport redirect-limit boundary was hardened so an over-limit 307/308 throws instead of returning a redirect response a downstream client might follow. The local MCP security suite passed all 70 tests and the combined affected API test suite passed all 303 tests across five suites. The Tailwind typography test now invokes the real CSS compiler from an isolated Node process rather than attempting a process-wide loader inside Jest; the three typography tests passed locally. CI verification of the new exact head remains mandatory.

## Qualification gates
- [x] Source imported into authorized GoreeCloud fork with upstream lineage.
- [x] Upstream MIT copyright obligations acknowledged.
- [x] Initial product identity and source-development overlay present.
- [ ] Fully migrated Glaze UI and localized user-facing branding.
- [ ] Native-owned integration interfaces and upstream isolation demonstrated.
- [ ] Build, unit, integration, accessibility and mobile smoke tests passed.
- [ ] Threat model, secure deployment defaults and independent supply-chain review.
- [ ] Upgrade, migration, backup/restore and rollback evidence.
- [ ] Staging deployment verified and release approval completed.

**Risk warning:** upstream Docker Compose includes an unauthenticated MongoDB configuration and externally supplied images. The development overlay does not make the deployment production-safe. No credentials, new production infrastructure, or live service are provisioned by this initial stage.
