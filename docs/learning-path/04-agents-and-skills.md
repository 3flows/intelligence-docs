---
title: 4. Add skills and agents
---

# 4. Add skills and agents

After you have service tools and chat/inference working, add skills and agents for task-oriented AI work.

## Skills: reusable capability bundles

A skill is declarative. It bundles instructions, tool references, examples, and policy. It does not contain TypeScript execution logic.

```yaml title="starter/intelligence.yml"
skills:
  - name: starter_support
    description: Answer starter support questions and look up sample orders.
    instructions:
      - Prefer verified order data over guesses.
    tools:
      - service: SupportService
        tags: [public]
```

Executable behavior stays in `SupportService` handlers and tools.

## Agents: run-based task harnesses

An agent uses a model plus instructions/skills/tools/policy. It creates runs and events.

```yaml title="starter/intelligence.yml"
agents:
  - name: starter_agent
    model: DEFAULT
    displayName: Starter Agent
    description: A small task-oriented agent for the starter app.
    instructions:
      - Work step by step and call tools when useful.
    skills:
      - starter_support
    tools:
      - service: SupportService
        tags: [public]
    policy:
      allowDestructive: false
      maxToolRounds: 3
    workspace:
      docs: agent-workspace
      blobs: agent-artifacts
      namespace: starter/agent
      tools: true
```

## Start an agent from a service

```ts title="starter/support-service.ts"
handler('runAgent', AgentInput, AgentOutput, async ({ task }, trigger) => {
  const run = await trigger.context.agent('starter_agent').task(task).run();
  await trigger.ok({ runId: run.runId, status: run.status, text: run.text });
});
```

Use the run id to inspect status/events, steer, resume, or stop a run.

## Agent or chatbot?

| Use chatbot | Use agent |
| --- | --- |
| A human is chatting with a named assistant | A task is being run and tracked |
| Session history is central | Run status/events are central |
| The frontend thinks in messages | The application thinks in tasks |

## Agent or workflow?

Use an agent when the model should decide how to pursue a task. Use a workflow when the process is known and should be deterministic/auditable step by step.

Next: [orchestrate the building blocks with workflows](./05-workflows.md).
