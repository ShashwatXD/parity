# Parity

Agent control plane for MCP + coding runtimes (TypeScript). UI inspired by OpenHands Agent Canvas.

All 4 MCP Studio roadmap phases ship as a working MVP; workspace/sandbox agent runtime is next.

```bash
cp .env.example .env
npm run install-all
npm run dev
```

- UI: http://localhost:3000  
- API: http://localhost:5005/api/health  

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

## Docker

```bash
docker compose up --build
```
