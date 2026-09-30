---
title: 19. See what the model did
---

# 19. See what the model did

**Where we are:** the desk is ready for production.

**The problem:** in the first week, two questions arrive. The support lead: *"Why did ticket 5f0c go to billing?"* The shop owner: *"What does a ticket cost us?"* Neither is answerable from the logs.

## The solution: inference runs, metadata and traces

### Every call is a record

Since chapter 10, the YAML registers `IntelligenceConversationsOntology`. That does more than store conversations: **every model call** becomes an `AIInferenceRun` entity, with operation, AI, model, tokens, latency, status, and the names and versions of the prompts it used.

What's missing is the link to our domain. That's `.metadata(...)`, on any chain:

```ts title="triage.ts"
export async function triage(ticket: StoredTicket): Promise<Triage> {
    const ai = Intelligence.inference();
    // highlight-next-line
    const tag = { ticketId: ticket.id, job: 'triage' };

    const [department, topics, urgent, frustration, facts] = await Promise.all([
        ai.choice('department').model(TRIAGE).metadata(tag).oneOf(departments).with(text).ask('…'),
        ai.choice('topics').model(TRIAGE).metadata(tag).manyOf(Topic.options).with(text).ask('…'),
        // … the same for check, score and extract
    ]);
    // …
}
```

```ts title="services.ts"
const assistant = (ticket: StoredTicket) => Intelligence.conversations()
    .conversation(`ticket-${ticket.id}`)
    .prompt('support.chat', { shop: 'Velo' })
    // highlight-next-line
    .metadata({ ticketId: ticket.id, job: 'chat' })
    .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage });
```

Now both questions are queries.

### What did a ticket cost?

```ts title="services.ts"
import { InferenceRunEntity } from '@3flows/intelligence';

const Usage = t.object({ calls: t.number(), inputTokens: t.number(), outputTokens: t.number(), byJob: t.record(t.string(), t.number()) });

handler('ticketUsage', t.object({ ticketId: t.string() }), Usage, async ({ ticketId }, trigger) => {
    // highlight-next-line
    const runs = await InferenceRunEntity.find({ 'metadata.ticketId': ticketId }).all();
    const usage = { calls: runs.length, inputTokens: 0, outputTokens: 0, byJob: {} as Record<string, number> };
    for (const { data } of runs as any[]) {
        usage.inputTokens += data.inputTokens;
        usage.outputTokens += data.outputTokens;
        usage.byJob[data.metadata.job] = (usage.byJob[data.metadata.job] ?? 0) + data.totalTokens;
    }
    await trigger.ok(usage);
})
```

From a run of the sample against a local model, one ticket and two chat messages:

```json
{ "calls": 10, "inputTokens": 3334, "outputTokens": 582, "byJob": { "triage": 719, "guardrails": 99, "chat": 3098 } }
```

Tokens times the provider's price per token is the cost. Split by job, it also shows where to optimize: here, the chat, which resends the history, the ticket and four help center passages on every turn.

### Why did it decide that?

The ticket stores the decision and its `reason` since chapter 4. The run shows the rest: which AI and model answered, when, how long it took, and with which prompt version. The guardrails from chapter 18 get the same tag (`screen(message, ticketId)` adds `{ ticketId, job: 'guardrails' }`). The `explain` handler in the sample lists all runs of a ticket:

```json
[
  { "operation": "structured", "ai": "triage", "model": "gpt-4.1-nano", "latencyMs": 412, "status": "completed" },
  { "operation": "chat", "ai": "DEFAULT", "model": "gpt-4.1", "prompts": [{ "name": "support.chat", "version": "v3" }], "latencyMs": 1830, "status": "completed" }
]
```

### Traces, for the full picture

Records answer *what* and *how much*. For *what exactly did the model see*, turn on a tracer. With MLflow:

```yaml title="intelligence.yml"
tracers:
  - name: DEFAULT
    enabled: ${{ MLFLOW_ENABLED }}   # unset: off
    provider: mlflow
    parameters:
      trackingUri: ${{ MLFLOW_TRACKING_URI }}
      experimentId: ${{ MLFLOW_EXPERIMENT_ID }}
```

Every call becomes a span with its full input and output: `structured:department`, `chat`, tool calls inside the chat that requested them. The metadata appears as span attributes, so you can filter by `ticketId`. Setup: [Observability](../guides/observability.md).

## Run it

```sh
yarn step:19
# create a ticket and chat, as before, then:
curl -X POST localhost:3000/ticketUsage -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…"}'
```

## What you learned

- **Every model call is an `AIInferenceRun`** once the ontology is registered: tokens, latency, model, prompt versions.
- **`.metadata({...})` links calls to your domain**, and is queryable.
- **Tracers** show the full inputs and outputs, span by span.

## Reviewer's view

> Every model call is tagged with its ticket and job; `ticketUsage` sums tokens per ticket.

Two things to check. Traces and runs contain customer data: the tracing backend needs the same access control and retention as the ticket database. And somebody should look at `ticketUsage` numbers before the bill does.

[Sample: step 19](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/19-observability) · Next: [What's next](./whats-next.md)
