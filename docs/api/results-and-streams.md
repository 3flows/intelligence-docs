---
title: Results and streams
---

# Results and streams

## `AIChatResponse`

Returned by `chat().answer()`.

| Field | Type | Description |
|---|---|---|
| `text` | `string?` | The answer |
| `toolCalls` | `AIToolCall[]?` | Tool calls requested in the last round, if the round limit was reached |
| `usage` | `AIUsage?` | Tokens of the last model call |
| `model` | `string?` | The model that answered |
| `provider` | `string?` | The provider |
| `finishReason` | `string?` | Why the model stopped: `stop`, `length`, `tool_calls`, … |
| `raw` | `unknown` | The provider's response |

`finishReason: 'length'` means the answer was cut off by `maxTokens`.

## `AIUsage`

```ts
{ promptTokens?: number; completionTokens?: number; totalTokens?: number }
```

On every response that the provider reports usage for. With the tool loop, `usage` covers the last call only. With the `IntelligenceTrace` domain registered, every call is recorded with its own usage: see [See what it did](../tutorial/see-what-it-did.md).

## Decisions

| Chain | Type | `value` |
|---|---|---|
| `choice().oneOf(...)` | `OneOfDecision<T>` | `T` |
| `choice().manyOf(...)` | `ManyOfDecision<T>` | `T[]` |
| `check()` | `CheckDecision` | `boolean` |
| `score()` | `ScoreDecision` | `number` |

All have `confidence?`, `reason?` and `raw`. See [Decisions](./decisions.md).

## Streams

`chat().stream()` resolves with an **`InferenceStream<AIStreamEvent, AIChatResponse>`**. It's an `AsyncIterable` of events:

```ts
const stream = await Intelligence.inference().chat().question('Draft a reply.').stream();

for await (const event of stream) {
    switch (event.type) {
        case 'text.delta': process.stdout.write(event.text); break;
        case 'usage':      console.log(event.usage); break;
        case 'done':       console.log(event.response.text); break;
        case 'error':      console.error(event.error); break;
    }
}
```

And it has members for the common ways of using a stream, so most code doesn't need the loop:

| Member | |
|---|---|
| `stream.toReadable({ format: 'text' })` | A Node.js `Readable` of the text, for an HTTP response body |
| `stream.toReadable({ format: 'sse' })` | A `Readable` of every event, as server-sent events |
| `stream.text(): Promise<string>` | Waits for the end, resolves with the whole text |
| `stream.completed: Promise<AIChatResponse>` | The final response. Rejects if the stream failed |
| `stream.onSettled(fn)` | Calls `fn` once with `{ status: 'completed', value }`, `{ status: 'failed', error }` or `{ status: 'aborted' }` |

Chatbots and agents stream the same way, with events of their own.

### Events

| `type` | Fields | When |
|---|---|---|
| `input.started`, `input.progress`, `input.done` | `file`, `bytesRead?`, `totalBytes?` | While a file input is uploaded, where supported |
| `text.delta` | `text` | A piece of the answer |
| `tool.call.started` | `toolCallId`, `name` | The model starts to request a tool |
| `tool.call.arguments.delta` | `toolCallId`, `delta` | A piece of the tool call's arguments |
| `tool.call.completed` | `toolCall` | The request is complete |
| `tool.result` | `toolCallId?`, `name?`, `result?`, `error?` | The tool has run. The stream continues with the model's next answer |
| `usage` | `usage` | Token usage |
| `done` | `response: AIChatResponse` | The complete answer. Always last on success |
| `error` | `error` | The stream failed |

### Streaming over HTTP

A platform handler answers once. To show text as it arrives, answer from an HTTP **route** with the stream:

```ts
const stream = await context.inference().chat().question(message).stream();
stream.onSettled((result) => { /* store the turn, once it's complete */ });

trigger.setReadble(stream.toReadable({ format: 'text' }), { mimeType: 'text/plain; charset=utf-8' });
await trigger.ok();
```

See [Stream](../tutorial/stream.md) in the tutorial.
