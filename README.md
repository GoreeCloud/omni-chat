# Omni Chat

Omni Chat is GoreeCloud's open-source, multi-model AI conversation workspace. It is maintained as a **Fork-to-Native** evolution of the MIT-licensed [LibreChat](https://github.com/LibreChat-AI/LibreChat) project.

**Status: initial development.** Significant LibreChat code and architecture remain. This is not a native-complete or production-qualified release.

## Local development from source

You need a supported Node.js/npm environment or Docker and Docker Compose.

    git clone https://github.com/GoreeCloud/omni-chat.git
    cd omni-chat
    cp .env.example .env

Review the inherited configuration and establish unique persistent cryptographic secrets and credentials appropriate to the environment. Do not commit the environment file.

To run with a development **API built from this GoreeCloud checkout**, use:

    docker compose -f docker-compose.yml -f compose.omni-chat.yml up --build

This is **development-only**. Other services in the inherited Compose configuration still use third-party images, and the inherited MongoDB development service is unauthenticated. Do not expose the default stack to the public internet or treat it as production-hardened.

Run the Omni Chat source identity checks with:

    node --test tests/omni-chat-identity.test.mjs

## Roadmap and maintenance

The [Fork-to-Native architecture and qualification status](docs/OMNI_CHAT_FORK_TO_NATIVE.md) records current inherited features, proposed controlled interfaces, security gaps, acceptance gates and the maintenance approach. The upstream Git remote is LibreChat-AI/LibreChat, and any intake is manually reviewed. There is no automatic deployment or upstream merge.

## Legal attribution

Omni Chat incorporates code from LibreChat, distributed under the MIT License. Preserve the [LICENSE](LICENSE), third-party notices and attribution terms. GoreeCloud product branding does not imply the upstream code was independently created.
