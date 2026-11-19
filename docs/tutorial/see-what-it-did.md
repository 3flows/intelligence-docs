---
title: 24. See what it did
---

# 24. See what it did

**Where we are:** the desk is measured, guarded, on the right models, and doesn't block.

**The problem:** in the first week, two questions arrive. The support lead: *"Why did ticket 5f0c go to billing?"* The shop owner: *"What does a ticket cost us?"* Neither is answerable from the logs.

## The solution: inference runs, metadata and traces

### Every call is a record

Intelligence can record every model call in a domain of its own, **`IntelligenceTrace`**. It's registered like any platform domain:

```yaml title="intelligence.yml"
# Every model call is recorded as an inference run with its model calls: queryable like our own data.
entities:
  backend: docs
  domains:
    - IntelligenceTrace
```

From now on, every operation is an **`InferenceRun`** (what was asked for: a chat, a choice, a moderation, and whether it completed), with one **`ModelCall`** per call to a provider (which AI and model answered, tokens, duration). Recording is best-effort: if a record can't be stored, the call still returns its answer.

The trace domain is technical evidence. It's kept apart from our own data on purpose: tickets and chats are the business record, runs and calls are the record of what the model did for them.

What's missing is the link between the two. That's `.metadata(...)`, on any chain. Three keys have a meaning of their own: **`subjectType`** and **`subjectId`** say what the call was made for, **`purpose`** says which job it did.

```ts title="triage.ts"
export async function triage(context: Pick<IntelligenceServiceContext, 'inference'>, ticket: TriageInput): Promise<Triage> {
    const ai = context.inference();
    // Links every model call to this ticket and job: queryable as inference runs, visible in traces.
    // highlight-next-line
    const tag = { subjectType: 'ticket', subjectId: ticket.id, purpose: 'triage' };

    const [department, topics, urgent, frustration, facts] = await Promise.all([
        ai.choice('department').model(TRIAGE).metadata(tag).oneOf(departments).instructions('…').state(text).decide(),
        ai.choice('topics').model(TRIAGE).metadata(tag).manyOf(Topic.options).instructions('…').state(text).decide(),
        // … the same for check, score and extract
    ]);
    // …
}
```

```ts title="services.ts"
const assistant = (context: Pick<IntelligenceServiceContext, 'inference'>, ticket: StoredTicket, history: ChatTurn[]) => withAttachments(
    context.inference()
        .chat()
        .messages(recent(history))
        .prompt('support.chat', { shop: 'Velo' })
        // highlight-next-line
        .metadata({ subjectType: 'ticket', subjectId: ticket.id, purpose: 'chat' })
        .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage }),
    ticket
);
```

Now both questions are queries. One helper reads the runs of a ticket with their model calls. One thing to know about entity queries: they return ten records unless told otherwise, so the helper asks for all of them with `limit(0)`.

```ts title="services.ts"
import { IntelligenceTraceDomain } from '@3flows/intelligence';

/** Every model call made for a ticket: the inference runs tagged with it, and their calls to a provider. */
async function callsOf(ticketId: string) {
    const { InferenceRun, ModelCall } = IntelligenceTraceDomain;
    // Entity queries return ten records unless told otherwise: limit(0) reads them all.
    const runs = await InferenceRun.find({ subjectType: 'ticket', subjectId: ticketId }).limit(0).all();
    const calls = await Promise.all(runs.map((run) => ModelCall.find({ run: run.reference() }).limit(0).all()));
    return runs.flatMap((run, index) => calls[index].map((call) => ({ run: run.data, call: call.data })));
}
```

### What did a ticket cost?

```ts title="services.ts"
const Usage = t.object({ calls: t.number(), inputTokens: t.number(), outputTokens: t.number(), byJob: t.record(t.string(), t.number()) });

handler('ticketUsage', t.object({ ticketId: t.string() }), Usage, async ({ ticketId }, trigger) => {
    const calls = await callsOf(ticketId);
    const usage = { calls: calls.length, inputTokens: 0, outputTokens: 0, byJob: {} as Record<string, number> };
    for (const { run, call } of calls) {
        usage.inputTokens += call.inputTokens ?? 0;
        usage.outputTokens += call.outputTokens ?? 0;
        usage.byJob[run.purpose ?? 'other'] = (usage.byJob[run.purpose ?? 'other'] ?? 0) + (call.totalTokens ?? 0);
    }
    await trigger.ok(usage);
})
```

One ticket and one chat message, offline with the scripted provider, which reports 12 tokens per call:

```json
{ "calls": 10, "inputTokens": 90, "outputTokens": 18, "byJob": { "triage": 60, "guardrails": 36, "chat": 12 } }
```

Ten calls for one ticket and one message: five triage questions, the moderation, three checks, and one reply. With a real model, tokens times the provider's price per token is the cost. Split by job, it also shows where to optimize: usually the chat, which resends the history, the ticket and four help center passages on every turn.

### Why did it decide that?

The ticket stores the decision and its `reason` since chapter 5. The run shows the rest: which AI and model answered, how long it took, and with which prompt version. The guardrails and judges from Part 5 get the same tag with `purpose: 'guardrails'`. The `explain` handler in the sample lists all calls of a ticket:

```json
[
  { "operation": "structured", "ai": "triage", "model": "gpt-4.1-nano", "job": "triage", "prompts": [{ "name": "support.routing", "version": "v1" }], "status": "completed" },
  { "operation": "moderation", "ai": "moderation", "model": "omni-moderation-latest", "job": "guardrails", "prompts": [], "status": "completed" },
  { "operation": "chat", "ai": "DEFAULT", "model": "gpt-4.1", "job": "chat", "prompts": [{ "name": "support.chat", "version": "v3" }], "status": "completed" }
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

Every call becomes a span with its full input and output: `structured:department`, `chat`, tool calls inside the chat that requested them. The metadata appears as span attributes, so you can filter by `subjectId`. Setup: [Observability](../guides/observability.md).

## Run it

```sh
yarn step:24
# create a ticket and chat, as before, then:
curl -X POST localhost:3000/ticketUsage -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…"}'
```

## Test it

The scripted provider reports 12 tokens per call, so the arithmetic is checkable:

```ts title="step.test.ts"
test('every model call of the ticket is counted, by job', async () => {
    const usage = await post('http://127.0.0.1:3000/ticketUsage', { ticketId: id });

    // 5 triage questions; moderation (no tokens), payment check, promises check, grounded judge; 1 reply.
    assert.equal(usage.byJob.triage, 5 * 12);
    assert.equal(usage.byJob.guardrails, 3 * 12);
    assert.equal(usage.byJob.chat, 12);
});
```

## What you learned

- **The `IntelligenceTrace` domain records every model call**: an `InferenceRun` per operation, a `ModelCall` per call to a provider, with tokens, duration, model and prompt versions.
- **`.metadata({ subjectType, subjectId, purpose })` links calls to your domain**, and is queryable.
- **Traces are technical evidence, not the business record.** Tickets and chats stay in our own collections.
- **Tracers** show the full inputs and outputs, span by span.

## Reviewer's view

> Every model call is tagged with its ticket and job; `ticketUsage` sums tokens per ticket.

Two things to check. Traces and runs can contain customer data: the tracing backend needs the same access control and retention as the ticket database. And somebody should look at `ticketUsage` numbers before the bill does.

[Sample: step 24](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/24-see-what-it-did) · Next: [Going live](./going-live.md)
