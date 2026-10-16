# Omni Chat development release evidence

This document tracks release-blocking evidence for the draft development PR. It does not authorize promotion.

## Synthetic recovery

The `synthetic-recovery-smoke` GitHub Actions job exercises logical backup and restore with fresh, isolated MongoDB and PostgreSQL/pgvector containers. It verifies one synthetic MongoDB document and one restored vector row. No existing volumes, host ports, or real user data are part of this test. Its result is authoritative only for the exact GitHub commit that ran it.

Passing this test does **not** establish production backup or restore readiness. Existing-volume migration, rehearsal against an approved staging copy, retention and credential recovery, recovery-time objectives, and owner authorization remain separate release requirements.

## Supply-chain disposition

Mammoth 1.13.0 declares an old CLI-only `argparse@1.x` dependency, which pulled in vulnerable `sprintf-js` and previously produced three moderate production findings. An **isolated fresh-install compatibility test** demonstrated that npm can resolve the scoped `mammoth > argparse@^2.0.1` override without `sprintf-js`; both Mammoth library DOCX-to-HTML and CLI DOCX-to-Markdown conversion passed (the legacy CLI printed nonfatal deprecation warnings). The Omni Chat lockfile now uses root `argparse@2.0.1` with no nested parser or `sprintf-js`. `npm audit --omit=dev --audit-level=moderate` reports **zero advisories locally**, and the foundation CI gate has been tightened to block moderate-or-higher findings.

**Limitations:** A full local monorepo `npm ci` was terminated with exit code 137, so the complete clean-install compatibility has not been verified locally. The exact-head GitHub Actions dependency installation, document conversion suites and broader regression checks must pass before treating this remediation as release-accepted. Do not suppress or waive advisories, and continue tracking Mammoth upstream's CLI migration.

## Immutable development image provenance

The development Compose override now pins the inherited upstream RAG and optional admin-panel images to multi-architecture OCI index digests, and the effective Compose validator rejects mutable image tags. The admin profile also requires a 32-character or longer session secret when enabled; a negative configuration test rejects an empty value. Synthetic Docker Compose checks verified image digests, default admin exclusion and localhost ports without starting containers. See `docs/OMNI_CHAT_IMAGE_PROVENANCE.md` for the recorded digests and review obligations. Image pinning prevents silent upstream tag drift; it does not replace independent third-party vulnerability, license, signature or data-handling review.

## Browser focus-theme regression

Exact commit `48980f96c5b920474a2d36dfc280c72a0b0180e9` passed 11 of 12 GitHub workflow groups, but failed Playwright memory shards 3/6 and 6/6. The failing scenarios include focus outline colors, role-based width/offset, ring-only controls and form theme styles. Root cause: a high-specificity, unlayered `:focus-visible` outline in the product identity bridge overrode existing theme-owned CSS and Tailwind utilities, producing 27 reported focus-test failures. The remedy removes that duplicate declaration, leaving the inherited theme CSS responsible for keyboard-focus styling, and adds a source contract preventing its return. The next accessibility CI run exposed two stale assumptions: the themed login field reported a numeric **3px** outline width even when its outline style was **none**, because the shared `.lc-field` component intentionally renders keyboard focus with a Tailwind CSS **ring (`box-shadow`)**. The revised smoke test verifies the actual keyboard modality, `:focus-visible`, and either a solid outline at least 2px wide **or a focus-only CSS box-shadow ring that differs from the unfocused control**. A dedicated GitHub accessibility run on the first proposed test-only fix, `5750fbcc3`, revealed a **real missing focus ring**: `.webkit-dark-styles`' 50vh inset autofill shadow replaced the shared `.lc-field` Tailwind ring. The subsequent CSS fix composes the existing theme-owned ring and autofill inset only for keyboard-focused fields. This preserves theme-specific ring colors, widths and pointer-focus behavior instead of imposing a native outline. The exact CSS+test revision must pass GitHub's real frontend build and rendered browser acceptance. This revised browser check and the full Playwright suite require exact-head CI verification before the blocker can be marked resolved. Do not delete or weaken the existing focus-theme tests.

## Focus-ring acceptance evidence

The parent PR revision `d586083a220385f3abf563cc8237b55c08e9ecab` passed **all Playwright end-to-end jobs**, including six memory-transport and two Redis-transport shards, but its accessibility smoke failed because it demanded a native `solid` outline from a field designed to use a Tailwind ring. The product and test fix at `121d346be578938e01b924f8161ba3dca5eca8f0` passed the dedicated GitHub accessibility workflow on a clean runner (run `38898399050`, including build and axe-core checks) and a second manual verification run. The fix is integrated into the development PR, not merged into `dev` or production. Exact-head full workflow qualification is still required for any new revision.

## Release decision

**NO-GO** pending exact-head full end-to-end CI, authenticated and device qualification, approved staging migration and recovery, dependency review, full downstream Glaze qualification, and explicit owner release authorization.
