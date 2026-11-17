# Backend + analys (fanalys) i en tjänst: Node kör API:t och startar Python-analysen som underprocess.
# Byggs från repots rot: docker build -t fdata-backend .

# --- Bygg backend (TypeScript → dist/) -----------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# --- Körning -------------------------------------------------------------------------------
FROM node:20-bookworm-slim
ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_PATH=/opt/venv/bin/python

# Python för analysen, i en egen venv. DejaVu = typsnitt med svenska tecken för PDF-rapporterna
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY analysis/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

WORKDIR /app
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/node_modules backend/node_modules
COPY --from=build /app/backend/dist backend/dist
# Analysen hamnar på /app/analysis, som backend hittar via ../../analysis från dist/
COPY analysis/ analysis/

# Kör inte som root
RUN chown -R node:node /app
USER node

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/server.js"]
