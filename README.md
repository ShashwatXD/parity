# Parity · MCP Studio

All 4 roadmap phases are implemented as a working MVP.

```bash
cp .env.example .env
npm run install-all
npm run dev
```

- UI: http://localhost:3000  
- API: http://localhost:5005/api/health  

Docs: [roadmap](docs/roadmap-4-phases.md) · [architecture / connections](docs/architecture.md) · [interview](docs/interview-guide.md)

## Quick tour

1. **Chat** — talk to Ollama/OpenAI/etc; tools from connected MCP servers are callable  
2. **Servers** — connect stdio or Streamable HTTP MCP  
3. **Tool Registry / Playground** — browse and invoke tools like Postman  
4. **Workflows** — multi-step tool → artifact runs (+ background + HITL)  
5. **Observability** — execution timeline, tokens, latency  

## Docker

```bash
docker compose up --build
```
