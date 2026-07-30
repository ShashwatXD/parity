# Parity

Agent control plane for MCP + coding runtimes (TypeScript). UI inspired by OpenHands Agent Canvas.

All 4 MCP Studio roadmap phases ship as a working MVP; workspace/sandbox agent runtime is next.

```bash
cp .env.example .env
npm run install-all
npm run dev          # both (local only)

```

- UI: http://localhost:3000  
- API: http://localhost:5005/api/health  

**Workspace:** Settings → Workspace → path, or `PARITY_WORKSPACE`. If empty → `server/.data/workspace`.

## Deploy (backend first → then Vercel)

`npm run dev` is for local only. Production is two hosts:

### 1. Backend on Render (do this first)

1. Push the repo to GitHub.
2. Render → New → **Web Service** (same as usual — no special config file needed).
3. **Root Directory:** `server`
4. **Build:** `npm install && npm run build` · **Start:** `npm start`
5. **Node 22** (uses `node:sqlite`).
6. Attach a **persistent disk** mounted at `.data` (SQLite + workspace).
7. Set env: LLM keys, optional `VOYAGE_API_KEY`, optional `PARITY_WORKSPACE`.
8. Deploy → copy public URL, e.g. `https://parity-api.onrender.com`
9. Check `https://parity-api.onrender.com/api/health`

Leave `CORS_ORIGINS` empty for now (or set it after step 2).

### 2. Frontend on Vercel (after API URL exists)

1. Vercel → Import repo → **Root Directory:** `client`
2. Env **Production:** `NEXT_PUBLIC_API_URL=https://parity-api.onrender.com/api`  
   (must include `/api`; baked in at build time — change ⇒ redeploy)
3. Deploy → copy URL, e.g. `https://parity.vercel.app`

### 3. Wire CORS

On Render, set `CORS_ORIGINS=https://parity.vercel.app` (comma-separate more if needed) → redeploy API.  
Open the Vercel URL and use the app.

## Quick tour

1. **Chat** — talk to Ollama/OpenAI/etc; tools from connected MCP servers are callable  
2. **Servers** — connect stdio or Streamable HTTP MCP  
3. **Tool Registry / Playground** — browse and invoke tools like Postman  
4. **Workflows** — multi-step tool → artifact runs (+ background + HITL)  
5. **Observability** — execution timeline, tokens, latency  

## How it works

Every chat send hits `POST /api/chat` → `runAgentTurn`: save message, optional context condensation, build system prompt (workspace tools, MCP inventory, matching skills), then **one** `streamText` session. ReAct steps (tool calls) run inside that session — not as separate chat requests.

| Path | What runs |
|------|-----------|
| `"hi"` | Chat LLM only — usually no tools |
| Edit / run code | LLM → `file_editor` / `terminal` / `grep` / … → reply |
| “Where is X?” (after Reindex) | LLM → `codebase_search` → Voyage embed + cosine over SQLite chunks → reply |
| Browser / external MCP | LLM → connected MCP tool (e.g. Playwright) |

**RAG is opt-in:** not injected into every prompt. Reindex (Files panel) embeds the workspace; search only runs when the model calls `codebase_search` or you search in the UI. Chat model and embedding model are separate (e.g. Claude + Voyage `voyage-code-3`).

## Docker (both on one machine)

```bash
docker compose up --build
```

Optional `.env`: `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS` for non-localhost access.
