# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Tetrode is a multiplayer social gaming platform where real humans and AI agents play in the same room. The first game is **The Hidden Human**: one human joins a chat room of AI agents, the agents interrogate to expose the human, the group votes at the end. If the human survives, they win points.

Built on Celo. Currently in Celo Proof of Ship.

---

## Monorepo Structure

```
tetrode/
  client/   React + Vite + TypeScript frontend
  server/   Express + Prisma + TypeScript backend
  docs/     Architecture docs (not always up to date)
```

## Dev Commands

### Client
```bash
cd client
pnpm dev          # starts Vite dev server with --host (accessible on LAN)
pnpm build        # generates skill MD then tsc + vite build
pnpm lint
```

### Server
```bash
cd server
pnpm dev          # nodemon
pnpm build        # tsc
pnpm start        # runs compiled dist/server.js
pnpm lint
```

### Database
```bash
cd server
pnpm prisma migrate dev     # run migrations
pnpm prisma generate        # regenerate client after schema changes
pnpm prisma studio          # GUI
```

Prisma schema is split across `server/prisma/schema/` — multiple `.prisma` files, not one. The main entry is `schema.prisma`, domain models are in `room.prisma`, `game.prisma`, `chat.prisma`, `profile.prisma`.

---

## Backend Architecture

### Entry points
- `server.ts` — HTTP server bootstrap
- `app.ts` — Express app + routes
- `socket.ts` — Socket.IO setup
- `mcp.ts` — MCP server (tools exposed to AI agents via stdio)

### Key services
- `services/agent.service.ts` — Manages OpenCode AI agent sessions. Spawns an `opencode serve` process if not already running, then calls its HTTP API to create sessions (`/session`) and prompt them (`/session/:id/message`). Each AI participant in a room is a separate OpenCode session.

### Game system
Games are registered in `modules/games/game-registry.ts`. Each game implements `GameHandler` (`game-handler.interface.ts`) with two lifecycle methods: `onRoomStart` and `onRoomEnd`.

Currently only one game: **The Hidden Human** (`modules/games/hidden-human/`).

### Hidden Human files
| File | Purpose |
|------|---------|
| `hidden-human.handler.ts` | Game loop, agent timing, endGame, grace period |
| `hidden-human.prompts.ts` | All prompts sent to agents — personality system, mission rules, voting instructions |
| `hidden-human.tools.ts` | MCP tools agents can call (`cast_vote`) |

### Agent communication flow
1. Room starts → `subscribeAgents` sets up per-agent room bus handlers + starts the game timer
2. Room bus (`modules/room/room.bus.ts`) is an in-process EventEmitter. Messages are emitted to it; agent handlers fire and call `agentSaveAndEmit`
3. `agentSaveAndEmit` builds a prompt from recent DB messages, calls `agentService.promptAgentText`, simulates typing delay, saves to DB, emits `message:new` via Socket.IO
4. `doneAgents` Set — blocks an agent from sending. `gracePeriodRooms` — blocks handler from firing new triggers. `gameEndedRooms` — permanently blocks DB saves after game ends (prevents in-flight calls from saving after re-enable)
5. End of game: agents stop → votes tallied → result saved → agents manually triggered once for a reaction → 30s grace → leave messages → `game:ended` socket event

### Important state flags (module-level, not per-request)
- `thinking: Set<string>` — agent is currently in `agentSaveAndEmit`, prevents overlapping calls
- `pendingResponse: Map<string, boolean>` — message arrived while agent was thinking; triggers a follow-up
- `doneAgents: Set<string>` — agent is stopped (used during game end)
- `gracePeriodRooms: Set<string>` — blocks handler from triggering during grace period
- `gameEndedRooms: Set<string>` — once set at game end, no normal `agentSaveAndEmit` can save to DB

### MCP tools
The MCP server (`mcp.ts`) exposes tools to the OpenCode agent runtime. Each game registers its tools. Currently: `cast_vote` for Hidden Human. The agent calls this tool to vote; it writes to the `Vote` table.

---

## Frontend Architecture

### Routing
React Router. Two modes controlled by `VITE_APP_MODE` env var:
- Default: full app router with all game routes
- `marketing`: stripped router for the public marketing site

### Key pages
- `/games/the-hidden-human` — game listing/lobby
- `/games/the-hidden-human/:roomId` — live game room (`HiddenHumanCore.tsx`)

### Hidden Human client flow
`HiddenHumanCore.tsx` owns the full game UI. On mount: loads message history, connects socket, joins room. Receives `message:new`, `agent:typing`, `agent:stop-typing`, `game:ended` socket events. Optimistic message insert on human send, replaced by server-confirmed message.

### Socket service
`services/socket.service.ts` — thin wrapper around `socket.io-client`. Uses `socket.on` (adds listeners), cleaned up with `socket.off` in useEffect cleanup. One socket instance per service singleton.

### Auth
Privy for wallet auth. `PrivyAuthProvider` is skipped entirely when `VITE_APP_MODE === 'marketing'` (Privy requires HTTPS).

### Player identity
`services/player.service.ts` manages a persistent anonymous identity (`actorId`, `displayName`) stored in localStorage. This `actorId` is what the server uses to match a participant to the connecting human.

---

## Database Models (key ones)

- `Room` — has a `gameId` (matches game `publicId`), `status` (WAITING / ACTIVE / FINISHED)
- `Participant` — belongs to a Room, `type` is HUMAN or AI, `actorId` links to the OpenCode session ID (for AI) or player identity (for human)
- `Vote` — one per voter per room (`@@unique([roomId, voterParticipantId])`), upserted on change
- `ChatMessage` — `senderType` is SYSTEM, AI, or HUMAN; `senderParticipantId` null for SYSTEM messages

---

## Environment Variables

### Server (`.env`)
```
DATABASE_URL
PORT
BACKEND_URL
FRONTEND_URL
OPENCODE_PROVIDER
OPENCODE_MODEL_ID
OPENCODE_BASE_URL   # defaults to http://127.0.0.1:4096
PRIVY_APP_ID / PRIVY_APP_SECRET / ...
```

### Client (`.env`)
```
VITE_BACKEND_URL
VITE_APP_MODE       # set to "marketing" for the public marketing site
VITE_PRIVY_APP_ID
```
