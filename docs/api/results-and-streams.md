---
title: Results and streams
---

# Results and streams

## `AIChatResponse`

Returned by `chat().ask(...)`, chatbot turns, and agent/chatbot model calls.

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

On every response that the provider reports usage for. With the tool loop, `usage` covers the last call only; trace records can store each model/tool call when tracing/domain storage is configured.

## Decisions

| Chain | Type | `value` |
|---|---|---|
| `choice().oneOf(...)` | `AIOneOfDecision<T>` | `T` |
| `choice().manyOf(...)` | `AIManyOfDecision<T>` | `T[]` |
| `check()` | `AICheckDecision` | `boolean` |
| `score()` | `AIScoreDecision` | `number` |

All have `confidence?`, `reason?` and `raw`. See [Decisions](./decisions.md).

## Streams

`chat().stream(...)` returns an `InferenceStream<AIStreamEvent, AIChatResponse>`. It is an `AsyncIterable<AIStreamEvent>` and also exposes `completed`, `onSettled(...)`, `text()`, and `toReadable({ format: 'text' | 'sse' })`:

```ts
const stream = await Intelligence.inference().chat().stream('Draft a reply.');

for await (const event of stream) {
    switch (event.type) {
        case 'text.delta': process.stdout.write(event.text); break;
        case 'usage':      console.log(event.usage); break;
        case 'done':       console.log(event.response.text); break;
        case 'error':      console.error(event.error); break;
    }
}

const text = await stream.text();
const final = await stream.completed;
```

| `type` | Fields | When |
|---|---|---|
| `input.started`, `input.progress`, `input.done` | `file`, `bytesRead?`, `totalBytes?` | While a file input is uploaded, where supported |
| `text.delta` | `text` | A piece of the answer |
| `tool.call` | `toolCall` | The model requests a tool |
| `tool.result` | `result` | A tool result |
| `usage` | `usage` | Token usage |
| `done` | `response: AIChatResponse` | The complete answer. Always last on success |
| `error` | `error` | The stream failed |

### Streaming over HTTP

A platform handler answers once. To show tokens as they arrive, forward the stream from an HTTP route as server-sent events with `stream.toReadable({ format: 'sse' })`, or collect it with `stream.text()` and answer at the end.
