# Parity

Agent control plane for MCP + coding runtimes + multi-agent teams (TypeScript). UI inspired by OpenHands Agent Canvas.

```bash
cp .env.example .env
npm run install-all
npm run dev
```

- UI: http://localhost:3000  
- API: http://localhost:5005/api/health  

Separate processes: `npm run server` · `npm run client`

Working example: 
<img width="1016" height="727" alt="Screenshot 2026-07-31 at 16 40 37" src="https://github.com/user-attachments/assets/fac49879-c19d-41a4-a30a-9a200cfa6c4e" />


**Workspace:** Files → **Select folder** (native dialog on the API host → real path). Or paste an absolute path → **Set**.

## Quick tour

1. **Chat** — LLM + workspace tools + connected MCP  
2. **Servers** — stdio / Streamable HTTP MCP  
3. **Tools / Playground** — inspect and invoke tools  
4. **Workflows** — multi-step runs (`tool`, `agent`, `parallel`, `synthesize`, `handoff`, `team`) + HITL  
5. **Teams** — named agent roster + hierarchical director → workers → synthesis  
6. **Observability** — timeline, tokens, evals  

## Multi-agent teams

Parity ships default agents (`director`, `researcher`, `coder`, `reviewer`, `synthesizer`).

| Surface | How |
|---------|-----|
| Chat | `run_team` tool (or `delegate_task` with an agent name) |
| UI | **Teams** nav — run task, edit roster, view recent runs |
| API | `POST /api/teams/run`, `GET /api/agents`, workflow step `type: "team"` |
| Workflows | Steps: `agent`, `parallel`, `synthesize`, `handoff`, `team` |

Shared team state (plan, messages, artifacts) is stored per run and appears in observability events.

## How it works

`POST /api/chat` → `runAgentTurn` → one `streamText` session (ReAct tool steps inside that call).

| Message | Typical path |
|---------|----------------|
| `"hi"` | Chat LLM only |
| Edit / run code | `file_editor` / `terminal` / `grep` / … |
| “Where is X?” | `codebase_search` after Reindex (Voyage embeddings) |
| Multi-agent task | `run_team` → director plan → parallel workers → synthesis |
| Browser MCP | Connected Playwright (etc.) tools |

RAG is opt-in (Reindex in Files). Chat model ≠ embedding model.

## Docker

```bash
docker compose up --build
```
