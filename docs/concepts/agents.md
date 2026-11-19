# Agents

Agents are model-powered task harnesses. Use an agent when the unit of work is a **run**: a model receives a task, may call tools, may emit progress events, may wait for confirmation, may keep workspace memory, and may delegate to peers.

Agents are not the old 0.8 `Channel → Agent → Skill` dispatch layer. In 0.9, agents are configured primitives that execute through the Intelligence-enriched Platform service context and call Fluent chat underneath.

## Minimal agent

```yaml
agents:
  - name: order_ops
    model: DEFAULT
    displayName: Order Operations
    description: Resolves delivery and order-status problems.
    instructions:
      - Work step by step.
      - Look up the order before proposing an action.
    tools:
      - service: SupportService
```

Run it from an `IntelligenceService` handler:

```ts
const result = await trigger.context
  .agent('order_ops')
  .task('Resolve the delayed delivery for order A-1042.')
  .input({ orderId: 'A-1042' })
  .run();
```

## Runs and events

Agent runs are persisted separately from chatbot sessions. A run can be started, streamed, steered, resumed, stopped, inspected, and listed for events.

```ts
const agent = trigger.context.agent('order_ops');

const run = await agent.task('Check order A-1042.').run();

for await (const event of agent.task('Explain progress while checking A-1042.').stream()) {
  // run.started, step.started, text.delta, tool.started, tool.completed,
  // interaction.required, delegation.started, run.completed, run.failed, ...
}

await agent.run(run.runId).steer().message('Prioritize a customer-visible summary.').submit();
await agent.run(run.runId).resume().context({ confirmedTools: ['refund_order'] }).submit();
const status = await agent.run(run.runId).status();
const events = await agent.run(run.runId).events();
await agent.run(run.runId).reason('operator requested stop').stop();
```

## Policy

Agents can enforce policy over discovered tools:

```yaml
agents:
  - name: order_ops
    policy:
      allowTags: [public, order]
      denyTags: [internal]
      allowDestructive: false
      requireConfirmation: true
      maxSteps: 8
      maxToolRounds: 4
      timeoutMs: 60000
```

Tools marked destructive or `requiresConfirmation` produce an `interaction.required` event and put the run into `waiting`; resume with explicit confirmation context.

## Skills

Attach reusable capability bundles to agents:

```yaml
skills:
  - name: order_resolution
    instructions:
      - Inspect order state before recommending customer-visible actions.
    tools:
      - service: SupportService

agents:
  - name: order_ops
    skills: [order_resolution]
```

## Workspaces

An agent workspace is generic working memory, not a code repository. It indexes notes, facts, summaries, decisions, checkpoints, and artifacts using Platform docs/blobs.

```yaml
docs:
  - name: agent-workspace
    type: memory

blobs:
  - name: agent-artifacts
    type: memory

agents:
  - name: order_ops
    workspace:
      docs: agent-workspace
      blobs: agent-artifacts
      namespace: agents/order_ops
      tools: true
      maxInlineBytes: 8192
      storeLargeToolResultsAsBlobs: true
    context:
      strategy: hybrid
      memory:
        includeWorkspaceItems: true
        retrieveRelevantItems: true
        topK: 8
```

With `workspace.tools: true`, the harness exposes tools such as `remember`, `search_workspace`, `read_workspace_item`, `write_artifact`, and `checkpoint`.

## Peer delegation and Agent Cards

Agents can call local peer agents through generated tools:

```yaml
agents:
  - name: travel_planner
    peers:
      - agent: flight_specialist
      - agent: hotel_specialist

  - name: flight_specialist
    displayName: Flight Specialist
    description: Finds and compares flight options.
    capabilities: [flight_search, fare_comparison]
```

The parent model sees tools like `ask_flight_specialist`. Intelligence starts child runs, records delegation events, and persists `AgentDelegation` records. Optional A2A-shaped Agent Cards describe discoverability and capabilities; HTTP-exposed agents serve a card at `GET /<agent-path>/card`.

## Transports

Agents can be exposed through native HTTP run routes, AG-UI HTTP/SSE, and MCP tools:

```yaml
agents:
  - name: order_ops
    http:
      path: /agents/order_ops
      useHttp: api
    agui:
      path: /agents/order_ops/agui
      useHttp: api
    mcp:
      expose: true
      useMcp: intelligence-agents
      toolName: run_order_ops
```

Native HTTP routes include:

```text
POST /agents/order_ops/runs
POST /agents/order_ops/runs/stream
POST /agents/order_ops/runs/:runId/resume
POST /agents/order_ops/runs/:runId/steer
POST /agents/order_ops/runs/:runId/stop
GET  /agents/order_ops/runs/:runId
GET  /agents/order_ops/runs/:runId/events
```
