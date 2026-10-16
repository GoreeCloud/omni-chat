# Omni Chat development image provenance

**Scope:** Development Compose override only. This is not approval of upstream container images for production.

## Immutable upstream images

The original LibreChat Compose file inherits mutable `latest` tags. GoreeCloud pins the following OCI **index** digests in `compose.omni-chat.yml` to retain both Linux amd64 and arm64 platforms:

| Optional service | OCI index digest |
| --- | --- |
| RAG API | `registry.librechat.ai/librechat-ai/librechat-rag-api-dev-lite@sha256:a62ce2221b43a9bb57fa6cb733e7047c80132960272c33d5704028f3071a1251` |
| Admin panel | `registry.librechat.ai/clickhouse/librechat-admin-panel@sha256:a395465d1daa3c11495810a8c224df86675985d50de42e98e36eeedbd8aecb94` |

Both digests were resolved with `docker buildx imagetools inspect` and their amd64/arm64 manifests were observed on October 16, 2026. A digest prevents an image from silently changing when an upstream `latest` tag moves. It **does not** establish that its software is secure, maintained, non-malicious or GoreeCloud-owned.

The admin panel is opt-in only (`--profile admin`), has a localhost-bound port and secure cookie default, and requires a unique session secret of at least 32 characters for the profile-specific configuration check. RAG remains an externally built upstream image and must be replaced or security-reviewed before any production promotion.

## Review procedure before a digest update

1. Resolve the intended image's OCI index digest and its supported architectures independently using `docker buildx imagetools inspect`.
2. Record publisher, release provenance, build sources, signature or attestation evidence when available, vulnerability assessment, license obligations and affected platforms.
3. Change the image digest in the development overlay on a branch. Confirm the effective default and admin-profile Compose outputs show the intended immutable digest; no mutable image references must survive.
4. Rerun source identity, Compose configuration, auth/RAG integration and complete GitHub checks. A digest change creates a **new exact-head candidate** and does not inherit earlier CI acceptance.
5. Obtain independent image-security approval before considering deployment.

No containers need be launched merely to validate the merged Compose configuration. A full software bill of materials, signatures, third-party code review, RAG data handling and production migration/recovery rehearsals are still release blockers.
