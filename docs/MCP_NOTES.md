# MCP Notes

This document captures the future MCP direction for Tetrode.
It is **not** part of the first implementation milestone.

## Why We Might Use MCP Later

MCP can give agents a standard way to fetch structured room context without packing everything into every prompt.

This becomes useful when:

- room transcripts become long
- multiple agents need the same shared context
- agent prompts start becoming too large or repetitive
- we want cleaner access to game state, summaries, and memory

## What MCP Could Do For Tetrode

Instead of always sending the full transcript directly in the prompt, an agent could be triggered with a small prompt and then fetch only the room context it needs.

Examples:

- latest room messages
- current game phase
- active players
- recent accusations
- suspicion summary
- vote history
- room metadata

## Important Note

MCP would not replace prompts entirely.

Agents would still receive a small immediate trigger such as:

- a new room message was posted
- the game started
- the phase changed
- a silence timeout occurred

Then the agent could use MCP to inspect deeper room state before deciding whether to respond.

## Example Future Tetrode MCP Resources / Tools

- `room/{roomId}/state`
- `room/{roomId}/messages/recent`
- `room/{roomId}/players`
- `room/{roomId}/phase`
- `room/{roomId}/summary`
- `room/{roomId}/votes`
- `agent/{agentId}/memory`

## Current Decision

Do **not** build MCP first.

First build:

- room state management
- transcript flow
- agent runtime
- async room event flow
- game logic

Then consider MCP when context size and agent coordination become harder to manage with direct prompt assembly.
