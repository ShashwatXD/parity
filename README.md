# Parity

Agent control plane for MCP + coding runtimes (TypeScript). UI inspired by OpenHands Agent Canvas.

```bash
cp .env.example .env
npm run install-all
npm run dev
```

- UI: http://localhost:3000  
- API: http://localhost:5005/api/health  

Separate processes: `npm run server` · `npm run client`

**Workspace:** Files → **Select folder** (native dialog on the API host → real path). Or paste an absolute path → **Set**.

## Quick tour

1. **Chat** — LLM + workspace tools + connected MCP  
2. **Servers** — stdio / Streamable HTTP MCP  
3. **Tools / Playground** — inspect and invoke tools  
4. **Workflows** — multi-step runs (+ HITL)  
5. **Observability** — timeline, tokens, evals  

## How it works

`POST /api/chat` → `runAgentTurn` → one `streamText` session (ReAct tool steps inside that call).

| Message | Typical path |
|---------|----------------|
| `"hi"` | Chat LLM only |
| Edit / run code | `file_editor` / `terminal` / `grep` / … |
| “Where is X?” | `codebase_search` after Reindex (Voyage embeddings) |
| Browser MCP | Connected Playwright (etc.) tools |

RAG is opt-in (Reindex in Files). Chat model ≠ embedding model.

## Docker

```bash
docker compose up --build
```
