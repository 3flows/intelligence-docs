---
title: Agents
---

# Agents

An **agent** is a model that works on a **task** in several steps. It decides which tool to use next, looks at the result, and goes on until it's done, inside limits you set.

That's the difference to everything else in this documentation. In a call, you decide what the model gets and it answers once. In a [workflow](./workflows.md), your code decides the steps. In an agent, the model chooses the next step, and you choose which steps exist.

| | Who decides the next step | Use for |
|---|---|---|
| A call (`chat`, `choice`, `extract`, …) | there is only one | a question with an answer |
| An agent | the model | work whose path depends on what it finds |
| A workflow | your code | a process you can write down |

Most features are calls, and should stay calls: they're cheaper, faster and easier to test.

## What an agent is made of

```yaml
agents:
  - name: case-researcher
    model: DEFAULT
    description: Prepares a brief for the person who takes over a ticket.
    instructions:
      - You prepare a brief for a support colleague who takes over a ticket.
      - You never write to the customer, and you never promise anything.
    skills:
      - case-research            # instructions and tools, bundled
    policy:
      allowDestructive: false
      maxToolRounds: 4
```

- **`instructions`** say who the agent is and what it delivers.
- **[`skills`](./skills.md)** and **`tools`** give it what it may use: handlers marked with `tool(...)`, selected by service and tag.
- **`policy`** is the limit.

Every field is described in the [configuration reference](../configuration/skills-and-agents.md).

## Running an agent

An agent is reached through the trigger context. It gets a task, and an input to work on:

```ts
const result = await trigger.context.agent('case-researcher')
    .using(trigger.context)
    .task('Prepare a brief for the colleague who takes over this ticket.')
    .input({ ticketId, subject: ticket.subject, body: ticket.body })
    .run();

result.runId;    // 'agent-run:…'
result.status;   // 'completed', 'waiting', 'failed', 'stopped'
result.text;     // what the agent wrote
```

There are two terminal verbs:

- **`run()`** waits and resolves with the result.
- **`stream()`** yields events while the agent works: `run.started`, `step.started`, `text.delta`, `tool.started`, `tool.completed`, `interaction.required`, `run.completed`, `run.failed`. Use it to show progress, or to record what the agent did.

```ts
for await (const event of trigger.context.agent('case-researcher').using(trigger.context).task(task).input(input).stream()) {
    if (event.type === 'tool.started') console.log(event.toolName);
    if (event.type === 'run.completed') console.log(event.result.text);
}
```

A run that already exists is addressed by its id:

```ts
const run = trigger.context.agent('case-researcher').run(runId);

await run.status();                                  // the current result
await run.events();                                  // the events recorded so far
await run.steer().message('Keep it short.').submit();
await run.resume().context({ confirmedTools: ['refund_order'] }).submit();
await run.reason('no longer needed').stop();
```

`steer` and `resume` continue a run that is `waiting`.

## Limits

An agent without limits is a loop with a credit card. `policy` sets them:

| | |
|---|---|
| `allowTags`, `denyTags` | Which tools it may see, by tag |
| `allowDestructive: false` | No tool that is marked `destructive` |
| `requireConfirmation: true` | Tools that change data wait for a person: the run becomes `waiting` and emits `interaction.required` |
| `maxToolRounds`, `maxSteps` | How far it may go |
| `timeoutMs` | How long it may take |

And the rule for tools holds here more than anywhere: the model fills in every argument. A tool that must only return one customer's data looks up *whose* data it is itself. See [Skills and agents](../tutorial/skills-and-agents.md) in the tutorial.

## More than one agent

An agent can ask another one. `peers` gives the model a tool for each peer (`ask_flight_specialist`); calling it starts a run of that agent and returns its result. `delegation` bounds it: `maxDepth`, `maxChildRuns`, `allowCycles`.

```yaml
agents:
  - name: travel-planner
    peers:
      - agent: flight-specialist
    delegation:
      maxDepth: 2
```

## Working memory

With `workspace`, an agent can keep notes, facts and artifacts while it works, stored in the platform's `docs` and `blobs`. With `workspace.tools: true`, it gets tools for that: `remember`, `search_workspace`, `read_workspace_item`, `write_artifact`, `checkpoint`.

## Over HTTP, AG-UI and MCP

| Block | Serves the agent as |
|---|---|
| `http` | Run routes under its `path`: `POST /runs`, `POST /runs/stream`, `GET /runs/:runId`, `GET /runs/:runId/events`, `POST /runs/:runId/resume`, `/steer`, `/stop`, and `GET /card` |
| `agui` | An AG-UI endpoint, for frontends that speak that protocol |
| `mcp` | Tools on a platform MCP server: `run_<agent>`, and tools for status, events, resume, steer and stop |

## Where runs are stored

Agents keep their records in the **`IntelligenceAgent`** domain: profiles, runs, steps, events, delegations and workspace items. The agent's model calls are recorded in the trace domain like any others, tagged with the run (`subjectType: 'agent-run'`).

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceTrace
    - IntelligenceAgent
```

A run holds the task and its input. Like chats and sessions, it needs a retention rule.

## Reviewer's view

Read three things. The **tool list**: is there anything on it that writes, sends or pays? The **scoping**: can any tool return data the task has no business with, whatever the model passes? The **limits**: what does a run cost at most, and what stops it?

:::caution Events in 0.9.0-next.4
In this version, `run(id).events()` returns only the first ten recorded events of a run. To record what an agent did, collect the events from `stream()`. See [Known gaps](../guides/known-gaps.md#chatbots-and-agents).
:::
