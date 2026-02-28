# Canvasplanner

Diagram-first flow runner for chaining LLM prompts across connected blocks. Build diagrams on a canvas, run individual blocks or entire flows, and persist everything (diagrams + per-block executions) to SQLite.

## Features
- Drag/drop blocks, connect with links (direction/type), edit labels inline.
- Per-block LLM prompt with optional web search; choose to let the LLM chunk its own output or use local chunking.
- Run single blocks or a connected flow (downstream traversal from entry points).
- Context menu controls: set command, toggle web search, toggle LLM chunking, run, run flow from here, delete block; right-click links to edit direction/type or delete.
- Persistence: save/load diagrams with labels; delete projects; execution logs stored in `BlockExecutions`.

## Getting Started
Prereqs: .NET 8 SDK, SQLite available on the host, and optionally Ollama for local LLM plus web search API key.

Install/restore/build:
```bash
dotnet restore
dotnet build canvasplanner.sln
dotnet run --project canvasplanner.csproj
```
The server runs on the default Kestrel port (usually https://localhost:5001).

## LLM & Search Configuration
- Base URL: `appsettings*.json` key `Ollama:BaseUrl` (defaults to `http://localhost:11434`).
- Model: `Ollama:Model` (defaults to `llama3`).
- Web search: set `Ollama:ApiKey` or env `OLLAMA_API_KEY`. Checkbox “Allow web search” on a block will fetch context and prepend it to the prompt automatically.

## Using the Canvas
- Add blocks with the toolbar; right-click a block to open the menu.
- To connect blocks: drag a side dot to another block’s side. Right-click a link to change direction/type or delete.
- Run options:
  - “Run LLM” in block menu executes just that block using upstream outputs as context.
  - “Run flow from here” executes downstream blocks breadth-first from that node.
  - Toolbar “Run Connected Flow” starts from entry blocks (no inbound links) or all blocks if none exist.
- Chunking: per-block toggle “Let LLM chunk output” to ask the model to split results; otherwise the app uses heuristic bullet/paragraph/sentence chunking.
- Delete: block menu “🗑 Delete block” removes the block and its connections; link menu “🗑 Delete connection”. Toolbar “Delete Project” removes the selected saved diagram and its executions.

## Data Storage
- SQLite file: `diagrams.db` in the repo root.
- Tables: `Diagrams` (label, JSON state) and `BlockExecutions` (per-run outputs, prompts, chunks).
- You can inspect executions with:
```bash
sqlite3 diagrams.db "SELECT BlockId, Command, ChunkedOutput, CreatedAt FROM BlockExecutions ORDER BY CreatedAt DESC LIMIT 10"
```

## Notes
- Cache busting is enabled for `wwwroot/diagram.js` via `_Host.cshtml`; if UI changes don’t appear, hard-refresh.
- The build currently emits a benign `CSSM_ModuleLoad` message on some macOS setups; build still succeeds.
