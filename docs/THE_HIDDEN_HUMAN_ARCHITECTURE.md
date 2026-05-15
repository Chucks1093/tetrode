# The Hidden Human Architecture

This document is the living architecture spec for **The Hidden Human**.
It captures the current agreed approach and should be updated as decisions change.

## 1. Build In 3 Layers

- Game loop
- Agent behavior
- Room architecture

## 2. Game Loop (First Playable)

- Lobby: players join, ready up.
- Role setup: exactly 1 hidden human participant, all other participants are **real OpenCode AI agent sessions**.
- Discussion phase (timer): shared chat room, everyone can message.
- Voting phase (timer): everyone votes one target.
- Resolution:
  - if voted target is human -> AI wins
  - else if human survives final round -> human wins
- Results screen: reveal roles + vote breakdown + replay.

## 3. Core Rules To Lock First

- Room size: e.g. 6 participants (1 human client + 5 OpenCode agent sessions).
- Rounds: fixed (2 or 3) to force tension.
- Message constraints: optional cooldown/char limit to prevent spam.
- Tie-break voting rule: random among tied or no elimination (pick one now).

## 4. AI Agent Behavior (MVP)

- Each AI tracks suspicion score per player.
- Signals used:
  - emotional language spikes
  - inconsistency in replies
  - "too human" spontaneity
  - response timing anomalies
- AI output style: mostly agent-like, but imperfect (small contradictions, wrong accusations).
- Each voting phase: AI votes highest-suspicion target.

## 5. Backend Architecture

- Room service: room state, timers, phase transitions.
- Game engine: deterministic state machine (lobby -> discussion -> voting -> resolution).
- Agent service: generates AI chat + suspicion updates.
- Realtime transport via WebSocket events:
  - `room:update`
  - `chat:message`
  - `phase:change`
  - `vote:submitted`
  - `game:ended`

## 6. Frontend Architecture

- Route: `/the-hidden-human`
- UI blocks:
  - player list (alive/suspected)
  - chat panel
  - phase/timer header
  - vote modal/panel
  - endgame reveal
- Keep it text-first, lightweight, same dark theme.

## 7. Anti-Cheat / Secrecy

- Only server knows true roles.
- Human role never sent to other clients.
- AI internal suspicion data never exposed to clients.
- Votes hidden until phase ends.

## 8. First Milestone

- Single-room prototype with OpenCode-created AI agents.
- Full phase transitions + voting + win logic working end-to-end.
- Then improve agent prompting/suspicion logic after gameplay loop is stable.

## 9. Agent Creation With OpenCode + Hidden-Role Isolation

Create AI participants using OpenCode SDK sessions while keeping role truth private.

- On match start, server creates:
  - 1 human participant entry (from real client)
  - N OpenCode agent sessions (one per AI participant)
- Server stores participant map and hidden truth privately (never broadcast).
- Each OpenCode AI session gets:
  - its own `agentPlayerId`
  - room transcript
  - game rules
  - explicit instruction: `"One hidden human exists; identity unknown."`
  - no access to hidden identity map

Why AI does not know the human:

- it never receives the human ID
- decisions come only from chat evidence + behavior signals

Implementation pattern:

- `GameEngine` owns truth (`hiddenHumanId`, phase, timers)
- `OpenCodeAgentOrchestrator` gets filtered state from `GameEngine` (`publicState` only)
- `publicState` excludes hidden identity
- at vote time, each agent votes from suspicion model over visible participants

Scaffold targets:

- `createOpenCodeAgents(room)` on server
- `buildPublicStateForAgentSession(sessionId)` filter
- suspicion-based `agentVote()` and `agentMessage()` functions

## 10. Real AI Agents Direction (OpenCode SDK)

Agreed direction:

- Do not model AI as fake human clients.
- Use real agent sessions as first-class participants in the room.

Approach:

- Keep one real human client in the room.
- Spin up multiple OpenCode-backed agent sessions server-side for AI players.
- Each agent receives only public room context (chat log, phase, timer, player list), never hidden role truth.
- Agents post messages and votes through the same game engine API as human users.
- Game engine remains authority for phases, timers, vote counting, and win conditions.

Architecture shape:

- Room/Game Engine (truth + rules)
- Human Client (WebSocket participant)
- AI Agent Orchestrator (manages agent sessions, polling/streaming replies, rate limits, retries)

This allows real AI agents to interact with each other and the human without knowing who the human is.

## 11. Update Rule

Every time we change decisions for The Hidden Human, update this file first.
