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
The upstream-status workflow fetches upstream main history without importing content and compares reachable Git ancestry. It separately reports upstream-only and GoreeCloud-only commits, avoiding false drift reports caused by our own branding and maintenance commits. An upstream-only count above zero means selective review is needed; an unrelated history or failed fetch is a check failure, not a silent green result. This check does not merge or deploy. Review upstream commits, release notes, licenses, threat and compatibility impact, then import scoped, tested changes as GoreeCloud commits. Do not overwrite the local product identity, merge unreviewed code, or automatically deploy upstream.

## Production dependency advisory baseline — October 16, 2026
A local npm production-dependency audit of the inherited initial lockfile returned 16 advisories (2 critical, 4 high, 4 moderate, 6 low). A non-force npm package-lock-only update reduced the follow-up audit to 10 (0 critical, 0 high, 4 moderate, 6 low). The lockfile update is a **development candidate**, not accepted release evidence. It changes thousands of lockfile lines and needs exact-head CI, integration checks, and review for dependency regressions. A new GitHub Actions production audit gate fails when any high or critical advisory is detected. Remaining moderate and low advisories require review and documented disposition. An advisory result does not alone prove exploitability or non-exploitability.

## October 16 telemetry privacy advisory reduction

The production dependency audit flagged `@opentelemetry/instrumentation-mongoose` below `0.67.0` for recording a database username in tracing attributes (GHSA-qqmp-wf37-98f9). Both affected workspaces (`api` and `packages/api`) now require `^0.69.0`, resolving to `0.69.0` in the lockfile. The follow-up production audit is **9 advisories: 0 critical, 0 high, 3 moderate, 6 low** (down from 10). Three telemetry test suites passed **37/37 tests**, and the shared API package build completed locally. Exact-revision GitHub CI and downstream compatibility checks remain mandatory; telemetry-export privacy also requires runtime qualification.

## October 16 hardening and regression evidence

The non-production Compose override now requires a unique, explicit PostgreSQL/pgvector password and propagates the same database name, username and password into RAG API. A newly configured CI job will test its effective merged configuration without launching containers or using production credentials on a GitHub Actions runner. **Local Docker Compose execution is unavailable on the development laptop**, and neither data-volume migration nor live RAG connectivity has been verified.

The MCP transport redirect-limit boundary was hardened so an over-limit 307/308 throws instead of returning a redirect response a downstream client might follow. The local MCP security suite passed all 70 tests and the combined affected API test suite passed all 303 tests across five suites. The Tailwind typography test now invokes the real CSS compiler from an isolated Node process rather than attempting a process-wide loader inside Jest; the three typography tests passed locally. CI verification of the new exact head remains mandatory. The rendered accessibility test now checks a mock-configured login form in desktop light and mobile dark reduced-motion modes; it does not exercise authenticated sessions.

## October 16 backend CI and development-stack hardening

The previous full `api` shard 1/3 CI reached approximately 5.5 GiB of accumulated Jest worker heap and crashed while loading the agent trace-context suite, despite 2,396 passing assertions. The API Jest configuration now recycles **idle workers between suites** when heap usage passes 1024 MB in CI, preserving the two-worker minimum and unchanged local defaults. A representative local CI-mode rerun of shard 1/3 passed all **93 suites and 2,406 tests** (one pre-existing skipped test), including the formerly crashed suite. The GitHub backend run at `c6740e165` passed all 13 jobs, including all three backend API shards and all four API-package shards. Exact-head verification remains mandatory after any further change.

The GoreeCloud development Compose override binds the source-built API to loopback (`127.0.0.1`), makes the inherited third-party administration panel **opt-in** via `--profile admin`, replaces the inherited public admin port with one bound to `127.0.0.1` using Docker Compose 2.24.4+ `!override` syntax, and enforces secure session cookies by default. The CI validator resolves both the default and explicitly enabled Compose configurations: the admin panel must be absent from default services and present with secure cookies when deliberately enabled. The effective-configuration gate also rejects host-published ports or host networking on MongoDB, Meilisearch, pgvector and RAG in both profiles, as well as host networking on the API or Admin panel; synthetic negative tests guard these boundaries. Runtime networking and staging acceptance remain unverified. This is defense-in-depth for local development, not a reviewed public deployment configuration; the panel's image, HTTPS endpoint, network exposure and credentials require separate review. Other inherited third-party services remain outside full production qualification.

## October 16 exact-head CI regressions under repair

At `67bcde39e8e87839cb09c133d284bb4b6664db9f`, 10 GitHub workflow groups passed, while backend shared API shard 2/4 failed 1 process-reaper timing assertion among 4,953 tests and Playwright memory shard 6/6 failed two welcome-disclaimer assertions. The two browser tests used the obsolete `librechat.ai` selector despite the genuine Omni Chat default footer linking to `https://github.com/GoreeCloud/omni-chat`; the selector now matches the owned product identity and is guarded by the identity contract. The reaper test now prevents bash's final-process replacement optimization and uses an explicit, longer SIGTERM grace interval to test its SIGKILL escalation under contention without removing any assertions. Eight consecutive local runs of the complete three-test reaper suite passed (24 test executions). The revised browser scenarios have not been qualified in a live full backend Playwright run yet. None of these changes authorize a production release.

## Development search security contract

The inherited development Compose file allowed `MEILI_MASTER_KEY` to expand to an empty value. The Omni Chat overlay now requires a dedicated `OMNI_MEILI_MASTER_KEY` and uses the same secret for the source-built API and Meilisearch. An absent or empty key must make Compose configuration fail before containers launch, including when the optional search feature is disabled. Synthetic merged-configuration CI tests verify shared nonempty credentials, alongside MongoDB, PostgreSQL and optional admin-panel restrictions. This is a development-only defense-in-depth change, not a production security review.

## Authenticator enrollment URL boundary

The TOTP enrollment URL now percent-encodes the issuer, account email and secret separately, preserving the required issuer/account label separator while preventing reserved characters in an email address from altering its `otpauth` query. The backend controller regression covers an address containing `+` and `&`, checks the decoded account label and rejects accidental extra parameters. The focused controller suite passed locally. This does not establish physical-authenticator interoperability or authenticated device acceptance; retain these as release gates.

## Authenticator and observability identity hardening

The two-factor enrollment controller now encodes the TOTP issuer, account label, and secret as URL components while preserving the `issuer:account` delimiter. This prevents reserved characters such as `&` in an email from corrupting the authenticator enrollment URI; the regression asserts the decoded label, exact issuer/secret, and absence of additional query parameters. The two affected authentication-controller suites passed **53 tests** locally. Physical-authenticator interoperability and authenticated end-to-end acceptance remain unverified.

The optional OpenTelemetry service name now defaults to `omni-chat` when not explicitly configured, and `.env.example` documents that identity. The existing `librechat.*` telemetry attribute namespace remains untouched for compatibility. The two targeted telemetry config and SDK suites passed **34 tests** locally; deployment-specific collector integration remains a separate qualification gate.

## Math rendering dependency security

A local production audit identified KaTeX `0.16.47` as vulnerable to a trust-bypass advisory and found the old version explicitly retained by three root npm overrides. Those overrides now require patched KaTeX `^0.18.2`; the lockfile resolves `0.18.10` consistently for Markdown, Mermaid and math rendering. The local production audit fell from nine advisories to **three moderate, zero low, zero high and zero critical**. Frontend LaTeX, Mermaid and Markdown suites passed **49 tests**, shared API math/LaTeX suites passed **83 tests**, and the client production build completed. A new foundation contract checks the locked version and all three overrides against the advisory floor. This is a candidate upgrade across a pre-1.0 version boundary and requires exact-head GitHub CI and rendered browser validation before release acceptance. Remaining moderate advisories affecting the inherited Mammoth / argparse / sprintf-js document-conversion dependency chain are not waived by this change.

## Glaze consumer smoke

The scoped Omni Chat login tests keyboard focus, reduced motion and theme identity at desktop and mobile sizes. The inherited theme and Tailwind focus roles, rather than the identity bridge, own keyboard outlines and preserve theme-specific colors, ring-only controls, custom widths/offsets and contrast modes. A preceding run exposed a scoped unlayered outline rule that overrode those roles in 27 Playwright cases; that rule was removed and a source regression now forbids product-scoped outline overrides. Exact-head E2E revalidation remains necessary. Glaze Stable 1.7.0 inherits its V1.6 runtime; this test does not grant downstream acceptance or physical-device qualification.

## MongoDB credential URI safety

The development overlay now passes a credential-free MongoDB base URI plus separate required root-credential environment variables. The API encodes each credential before attaching it to the MongoDB URL, preventing reserved password characters from changing the URI structure. The resolver rejects missing credential pairs and unexpected MongoDB hosts or databases, while preserving existing MONGO_URI behavior when the Omni Chat development variables are absent. Local regression tests cover malformed inputs and reserved characters; deployment and existing-volume migrations remain unqualified.

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
