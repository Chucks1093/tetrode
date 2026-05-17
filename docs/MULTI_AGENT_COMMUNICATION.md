# Multi-Agent Communication

This document captures the current communication design for AI agents inside Tetrode.

It is focused on how multiple AI agents and human players coexist in the same live room.

## Core Idea

Tetrode should not use a strictly synchronous turn-based agent system.

The communication model should feel like a real live group chat:

- agents can think at the same time
- agents can ignore messages
- agents can respond at different times
- agents can follow up later even if nobody has spoken again

## What We Do Not Want

We do **not** want a simple flow like this:

- human sends a message
- agent A replies
- agent B replies
- agent C replies

That feels too rigid and artificial.

## What We Want

We want asynchronous shared-room communication.

Each AI participant should act like a participant inside a group discussion, not like a synchronous function call in a queue.

## Shared Room Model

Agents do not communicate directly with each other through private links.

Instead:

- the server owns the room
- the server owns the transcript
- every message is stored in the room transcript first
- agents react to room events

So communication happens **through the shared room**, not by one agent calling another agent directly.

## How Agents Know What Happened

Agents do not magically know what was typed.

The server is responsible for telling them.

When something important happens in a room, the server sends that event into the agent runtime.

Examples:

- a human posted a message
- an agent posted a message
- the game started
- the phase changed
- the room has gone silent for some time

## Server Role

The server should not decide the actual content-level choice for the agent.

The server should not say:

- agent A must reply
- agent B must stay silent

Instead, the server is responsible for:

- storing room messages
- distributing room events
- enforcing cooldowns
- enforcing maximum reply pressure
- rejecting stale replies
- rejecting spammy replies
- broadcasting accepted replies

## Agent Role

Each agent should decide for itself:

- do I want to reply?
- do I want to ignore this?
- do I want to reply later?
- what exactly do I want to say?

This gives more believable conversational behavior.

## Event-Driven Communication

Agents should react to room events, not only human messages.

Useful event types include:

- `game.started`
- `message.created`
- `agent.message.posted`
- `silence.timeout`
- `phase.changed`
- `agent.followup.due`

This allows agents to:

- open the discussion at game start
- respond to human messages
- react to each other
- revive a silent room
- post a delayed follow-up thought

## Delayed Follow-Ups

An agent should be allowed to speak later even if no new human message was sent.

Example:

1. an agent says something
2. nobody responds
3. after a short delay, the same or another agent says:
   - "and also, I think she might be lying"

This should still be caused by an event, not random uncontrolled posting.

That event could be:

- a scheduled follow-up timer
- a silence timeout
- a delayed decision made earlier by the agent

## Recommended Decision Types

When an agent receives a room event, it should be able to return decisions like:

- ignore
- reply now
- reply later
- schedule a follow-up

Example conceptual shape:

```ts
type AgentDecision =
   | { action: 'ignore' }
   | { action: 'reply_now'; text: string }
   | { action: 'reply_later'; text: string; delayMs: number }
   | { action: 'schedule_followup'; delayMs: number; reason?: string };
```

## Asynchronous Room Flow

The communication flow should look like this:

1. a room event happens
2. the server stores it if needed
3. the server distributes the event to agent processing
4. each agent independently decides whether to respond
5. returned replies go through room validation
6. valid replies are stored in the transcript
7. the room broadcasts the accepted message

## Room Validation Layer

The server still needs a guardrail layer before posting an agent reply.

Examples:

- is the room still in discussion phase?
- is this reply too late?
- is this reply stale compared to the current transcript version?
- is this agent posting too frequently?
- are too many agents already speaking at once?

This means:

- agents decide intention
- server decides permission

## Why This Matters

This communication layer is not just a game detail.

It is effectively the runtime layer for multi-agent social interaction inside Tetrode.

It enables:

- believable live chat pacing
- parallel agent thinking
- delayed social reactions
- group discussion dynamics
- human and AI participation in the same room

## Current Decision

For Tetrode:

- use WebSocket for human client realtime room updates
- use backend-internal async orchestration for agent communication
- use OpenCode sessions as the agent runtime
- keep the room transcript on the server as the authoritative source of truth

## Future Extension

Later, MCP may help agents fetch room context in a structured way instead of receiving large prompt payloads every turn.

That is a later-stage improvement, not part of the first implementation milestone.
