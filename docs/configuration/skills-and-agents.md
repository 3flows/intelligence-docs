---
title: skills and agents
---

# `skills` and `agents`

Concepts: [Skills](../concepts/skills.md) and [Agents](../concepts/agents.md).

## `skills`

```yaml
skills:
  - name: case-research
    description: Collect the facts of a support case before a person answers it.
    instructions:
      - Read the chat of the ticket first.
    tools:
      - service: SupportService
        tags: [case]
```

| Field | Description |
|---|---|
| `name`, `description` | What the skill is for |
| `instructions` | Text or a list. Added to the instructions of every agent that uses the skill |
| `tools` | Tool references: `service`, narrowed by `tags`, `include`, `exclude` |
| `examples` | `{ input?, approach?, output? }` |
| `policy` | Limits, as on an agent |
| `metadata` | Free-form |

## `agents`

```yaml
agents:
  - name: case-researcher
    model: DEFAULT
    description: Prepares a brief for the person who takes over a ticket.
    instructions:
      - You prepare a brief for a support colleague who takes over a ticket.
    skills:
      - case-research
    policy:
      allowDestructive: false
      maxToolRounds: 4
```

| Field | Description |
|---|---|
| `name` | The agent's name: `trigger.context.agent(name)` |
| `displayName`, `description`, `capabilities`, `tags` | What the agent is and can do. Used for its card, and for the tools other agents get to call it |
| `model` | An AI from [`ais`](./ais.md) |
| `instructions` | Text or a list |
| `skills` | Names of skills |
| `tools` | Tool references of its own, like a skill's |
| `policy` | `allowTags`, `denyTags`, `allowDestructive`, `requireConfirmation`, `maxSteps`, `maxToolRounds`, `timeoutMs` |
| `peers` | Other agents it may ask: `{ agent, as?, description?, tags?, timeoutMs? }` |
| `delegation` | Limits for asking peers: `maxDepth`, `maxChildRuns`, `allowCycles` |
| `workspace` | Working memory: `docs`, `blobs`, `namespace`, `tools`, `maxInlineBytes`, `storeLargeToolResultsAsBlobs` |
| `context` | What of the workspace and of earlier events is given to the model: `strategy`, `memory`, `recent`, `compaction` |
| `http` | Run routes: `path`, `useHttp` |
| `agui` | An AG-UI endpoint: `path`, `useHttp` |
| `mcp` | Tools on a platform MCP server: `expose`, `useMcp`, `toolName`, `description` |
| `a2a` | The agent's card: `discoverable`, `card` |
| `metadata` | Free-form |

## Over MCP

Two things can be offered to assistants outside the application, on a platform MCP server (`mcps`).

**A service's tools.** Of the handlers of a service listed under an MCP server, those marked with `tool(...)` are offered, with the name and description from `tool(...)`:

```yaml
mcps:
  - name: help-center
    port: 3003
    basepath: /mcp
    path: /help-center
    services:
      - name: HelpCenterService
```

**An agent.** With an `mcp` block, an agent becomes a set of tools on the MCP server named in `useMcp`: one to run it (`toolName`, by default `run_<agent>`), and `resume_`, `steer_`, `stop_`, `status_` and `events_<agent>` for its runs:

```yaml
agents:
  - name: desk-assistant
    mcp:
      expose: true
      useMcp: desk-agents
      toolName: run_desk_assistant
      description: Ask the desk assistant about a ticket.

mcps:
  - name: desk-agents
    port: 3004
    basepath: /mcp
    path: /agents
```

## Storage

Runs, steps, events, delegations and workspace items are stored in the `IntelligenceAgent` domain:

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceAgent
```

Workflows have no YAML section: they're defined in code and registered by a service. See [Workflows](../concepts/workflows.md).
