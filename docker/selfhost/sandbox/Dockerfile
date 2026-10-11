# Agent sandbox for self-hosting: the HackerAI Kali image (docker/Dockerfile)
# running the local sandbox client from this repository's packages/local.
# Build context is the repository root.
ARG SANDBOX_BASE_IMAGE=hackerai/sandbox:latest
FROM ${SANDBOX_BASE_IMAGE}

USER root
WORKDIR /opt/hackerai-local
COPY packages/local/package.json packages/local/tsconfig.json ./
COPY packages/local/src ./src
# Build inside the sandbox image so the optional node-pty addon matches its
# Node.js runtime; npm tolerates node-pty failing to build.
RUN npm install --no-audit --no-fund \
    && npx tsc \
    && npm prune --omit=dev --no-audit --no-fund \
    && rm -rf src /root/.npm
COPY docker/selfhost/sandbox/entrypoint.sh /usr/local/bin/hackerai-sandbox-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/hackerai-sandbox-entrypoint \
    && chmod 755 /usr/local/bin/hackerai-sandbox-entrypoint \
    && mkdir -p /home/user/.hackerai \
    && chown -R user:user /home/user/.hackerai

USER user
WORKDIR /home/user
ENTRYPOINT ["/usr/local/bin/hackerai-sandbox-entrypoint"]
