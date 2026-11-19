---
title: chat()
---

# `chat()`

One call: instructions, input and a question in, text out. Requires the `chat` capability, `tools` when tools are attached, and `streaming` for `.stream()`.

```ts
const answer = await Intelligence.inference()
    .chat()
    .prompt('support.reply', { shop: 'Velo Bikes' })
    .with(ticket)
    .question('Draft a reply to this ticket.')
    .answer();

answer.text;    // the reply
answer.usage;   // { promptTokens, completionTokens, totalTokens }
```

## Methods

In addition to the [shared methods](./overview.md#methods-shared-by-all-chains):

| Method | Description |
|---|---|
| `.question(input, meta?)` | The task of this call: text, or any input value |
| `.messages(messages: AIMessage[])` | The history so far: `{ role: 'user' \| 'assistant' \| 'system' \| 'tool', content }`. See [`History.window`](#history) |
| `.inputs(inputs: AIInput[])` | Add already normalized inputs |
| `.tools(...tools: InferenceTool[])` | Offer inline tools. See [Tools](./tools.md) |
| `.service(service, method, options?)` | Offer one platform service handler as a tool |
| `.services(definitions)` | Offer several service handlers |
| `.toolsFrom(service, { include?, exclude?, tags? })` | Offer every handler of a service that is marked as a tool with `tool(...)` |
| `.maxToolRounds(rounds: number)` | Maximum tool rounds before returning. Default `3` |
| `.responseSchema(schema: t.ZodType, name?)` | Ask for an answer that matches a schema. The parsed value is in `answer.parsed` |

## Terminal verbs

### `.answer(): Promise<AIChatResponse>`

Sends the call. If the model requests tools, runs them and calls the model again, up to `maxToolRounds`. Resolves with the final answer.

### `.stream(): Promise<InferenceStream<AIStreamEvent, AIChatResponse>>`

Sends the call and resolves with a stream. Note the `await` before iterating:

```ts
const stream = await chat.question('Draft a reply.').stream();

for await (const event of stream) {
    if (event.type === 'text.delta') process.stdout.write(event.text);
    if (event.type === 'done') console.log(event.response.usage);
}
```

A stream runs tools too: the stream carries the tool call and its result, and continues with the model's next answer. See [Results and streams](./results-and-streams.md) for the events and for what an `InferenceStream` can do.

## What the model receives

In order:

1. one system message with all `instructions`, then all rendered `prompt`s, joined by blank lines,
2. the `messages`,
3. one user message per input, in the order of `with` / `withFile` / `withBlob`,
4. the question as the last user message.

## History

A model is stateless: to continue a conversation, send what was said before with `.messages(...)`. `History.window` keeps the request bounded:

```ts
import { History } from '@3flows/intelligence';

const recent = History.window(messages, { maxMessages: 20 });   // or { maxTokens: 4000 }, an approximation

await Intelligence.inference().chat().messages(recent).question('It is the front one.').answer();
```

Where the history is stored is the application's decision: see [Remember](../tutorial/remember.md). For a conversation between one person and one assistant that needs no application around it, use a [chatbot](../concepts/chatbots.md).

## Examples

**A reusable chain**

```ts
const replies = Intelligence.inference().chat().prompt('support.reply').options({ temperature: 0.3 });
const draft = await replies.with(ticket).question('Draft a reply.').answer();
```

**Bounded and traceable**

```ts
await trigger.context.inference()
    .chat()
    .metadata({ subjectType: 'ticket', subjectId: ticket.id, purpose: 'reply' })
    .timeout(10_000)
    .signal(trigger.signal)
    .with(ticket)
    .question('Draft a reply.')
    .answer();
```

**A specific model and provider options**

```ts
await Intelligence.inference()
    .chat()
    .model('reasoning')
    .options({ raw: { reasoning_effort: 'high' } })
    .with(contract)
    .question('List every clause that deviates from our standard terms.')
    .answer();
```

## See also

- [Tools](./tools.md): letting the model call your services.
- [Chatbots](../concepts/chatbots.md): configured assistants with their own sessions.
