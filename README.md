# Omni Chat

Omni Chat is GoreeCloud's open-source, multi-model AI conversation workspace. It is maintained as a **Fork-to-Native** evolution of the MIT-licensed [LibreChat](https://github.com/LibreChat-AI/LibreChat) project.

**Status: initial development.** Significant LibreChat code and architecture remain. This is not a native-complete or production-qualified release.

## Local development from source

You need a supported Node.js/npm environment or Docker and Docker Compose.

    git clone https://github.com/GoreeCloud/omni-chat.git
    cd omni-chat
    cp .env.example .env

Review the inherited configuration and establish unique persistent cryptographic secrets and credentials appropriate to the environment. Do not commit the environment file. For a new development database, configure OMNI_MONGO_ROOT_USERNAME and OMNI_MONGO_ROOT_PASSWORD in .env. Missing values fail Docker Compose configuration. Use a long unique random password. The source-built API encodes MongoDB credentials before building the connection URI, so reserved characters such as `@`, `%`, and `#` work correctly. Do not reuse development credentials in production.

For new vector-database volumes, configure `OMNI_POSTGRES_PASSWORD` in `.env` as well. The source-built development overlay supplies matching PostgreSQL credentials to both `vectordb` and `rag_api`, rather than retaining the upstream sample password. Use long, randomly generated URL-safe values.

**Existing database warning:** enabling MongoDB authentication or changing PostgreSQL initialization credentials does not automatically migrate existing MongoDB/PostgreSQL data volumes. Back up data, establish credentials and restore into an isolated tested target before using the updated overlay. The inherited base Compose file still contains sample services and must never be treated as production-hardened.

To run with a development **API built from this GoreeCloud checkout**, use:

    docker compose -f docker-compose.yml -f compose.omni-chat.yml up --build

This is **development-only**. The source-built API publishes only on `127.0.0.1` when both Compose files are used, and the authentication overlay applies to fresh MongoDB volumes only. Search also requires a unique `OMNI_MEILI_MASTER_KEY` shared with the API; it may not be blank even when `SEARCH=false`. Other services still use third-party images. The `!override` port replacement requires Docker Compose 2.24.4 or newer. Do not expose the development stack to the public internet or treat it as production-hardened.

The optional administration panel is excluded from the default developer stack. To enable it in an isolated HTTPS-capable development setup, add `--profile admin` to your Compose command. With Docker Compose 2.24.4 or newer, the overlay replaces the inherited public admin port with a **localhost-only** binding; older Compose versions must not be used with this overlay. Before enabling it, set a unique 32+ character `ADMIN_PANEL_SESSION_SECRET` in `.env`. The development override pins the inherited admin and RAG images to reviewed multi-platform OCI digests, avoiding mutable `latest` tags. Image provenance and vulnerability review, an HTTPS proxy, and deployment security remain separate release gates.

Run the Omni Chat source identity checks with:

    node --test tests/omni-chat-identity.test.mjs

## Roadmap and maintenance

The [Fork-to-Native architecture and qualification status](docs/OMNI_CHAT_FORK_TO_NATIVE.md) records current inherited features, proposed controlled interfaces, security gaps, acceptance gates and the maintenance approach. The upstream Git remote is LibreChat-AI/LibreChat, and any intake is manually reviewed. There is no automatic deployment or upstream merge.

## Legal attribution

Omni Chat incorporates code from LibreChat, distributed under the MIT License. Preserve the [LICENSE](LICENSE), third-party notices and attribution terms. GoreeCloud product branding does not imply the upstream code was independently created.
