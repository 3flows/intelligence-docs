---
title: 2. Use Fluent inference
---

# 2. Use Fluent inference

After `ais:` exists, application code calls models through Fluent inference:

```ts
trigger.context.inference().chat().question('...').answer()
```

Use Fluent inference when the application owns the operation: a draft, a decision, an extraction, a moderation check, a batch run, or a workflow step.

## Chat: text in, text out

```ts title="starter/support-service.ts"
handler('ask', AskInput, AskOutput, async ({ question }, trigger) => {
  const response = await trigger.context
    .inference()
    .chat()
    .prompt('support.reply', { shop: 'Velo' })
    .metadata({ purpose: 'starter.ask' })
    .timeout(10_000)
    .question(question)
    .answer();

  await trigger.ok({ answer: response.text ?? '' });
});
```

Use `.metadata(...)` to link the technical trace to app work, and `.timeout(...)` to bound remote calls.

## Decisions: language into data

When code branches on the result, do not parse free text. Use a typed decision primitive:

```ts
const decision = await trigger.context
  .inference()
  .choice('department')
  .state('Route this support ticket to the best department.')
  .oneOf(['billing', 'shipping', 'technical'])
  .with(ticket.text)
  .metadata({ purpose: 'starter.triage', subjectType: 'ticket', subjectId: ticket.id })
  .timeout(10_000)
  .decide();

if (decision.value === 'billing') {
  // normal TypeScript branch
}
```

The same idea applies to:

- `check(name)` for yes/no,
- `score(name)` for numeric judgments,
- `extract(name).schema(...)` for structured records.

## Tools from services

A model can call application code only through described tools. Mark service handlers with `tool(...)`:

```ts
const response = await trigger.context
  .inference()
  .chat()
  .toolsFrom('SupportService')
  .question('Where is order A-1042?')
  .answer();
```

The tool implementation is normal Platform service code; Intelligence only adds model-facing metadata and tool-call orchestration.

## Streaming

For streamed text:

```ts
const stream = await trigger.context.inference().chat().question('Draft a reply.').stream();
for await (const event of stream) {
  if (event.type === 'text.delta') process.stdout.write(event.text);
}
const final = await stream.completed;
```

`InferenceStream` is an async iterable and also has `.text()` and `.toReadable({ format: 'sse' })`.

## When not to use Fluent directly

Use a higher-level primitive when the shape calls for it:

| Situation | Use instead |
| --- | --- |
| Human-facing session with history | [Chatbot](./03-chatbots.md) |
| Task/run with events, tools, policy, workspace | [Agent](./04-agents-and-skills.md) |
| Known multi-step process | [Workflow](./05-workflows.md) |

Next: [expose an interactive chatbot](./03-chatbots.md).
