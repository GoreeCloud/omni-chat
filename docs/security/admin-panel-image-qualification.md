# Admin Panel image qualification

This branch preserves the validated experimental approach without changing the inherited Docker Compose image reference. At pinned upstream revision `82fb4b61409d5c2e6eceb3d116b89bc957c1620e`, the isolated build updates its vulnerable dependencies, builds with Bun 1.4.0, and runs `bun prune --production` before copying the production dependency tree into the runtime image.

Evidence: [AMD64 image scan](https://github.com/GoreeCloud/omni-chat/actions/runs/38985962115), [synthetic startup and health test](https://github.com/GoreeCloud/omni-chat/actions/runs/38986191859), [ARM64 image scan](https://github.com/GoreeCloud/omni-chat/actions/runs/38986266954). Both image scans reported zero critical and zero high findings.

These results do not approve deploying or publishing the image. Future candidate builds must reproduce the pinned upstream checkout and dependency versions on both native architectures, check application authorization flows, generate verifiable SBOM/provenance, and review configuration, licensing, privacy, migration, and rollback requirements. The RAG dependency vulnerability remains independent and unresolved.
