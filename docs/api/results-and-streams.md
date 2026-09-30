---
title: Results and streams
---

# Results and streams

## `AIChatResponse`

Returned by `chat().ask(...)` and `conversation(id).ask(...)`.

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

On every response that the provider reports usage for. With the tool loop, `usage` covers the last call only; the `AIInferenceRun` entities have every call. See [See what the model did](../tutorial/see-what-the-model-did.md).

## Decisions

| Chain | Type | `value` |
|---|---|---|
| `choice().oneOf(...)` | `AIOneOfDecision<T>` | `T` |
| `choice().manyOf(...)` | `AIManyOfDecision<T>` | `T[]` |
| `check()` | `AICheckDecision` | `boolean` |
| `score()` | `AIScoreDecision` | `number` |

All have `confidence?`, `reason?` and `raw`. See [Decisions](./decisions.md).

## Streams

`chat().stream(...)` and `conversation(id).stream(...)` resolve with an `AsyncIterable<AIStreamEvent>`:

```ts
const events = await Intelligence.inference().chat().stream('Draft a reply.');

for await (const event of events) {
    switch (event.type) {
        case 'text.delta': process.stdout.write(event.text); break;
        case 'usage':      console.log(event.usage); break;
        case 'done':       console.log(event.response.text); break;
        case 'error':      console.error(event.error); break;
    }
}
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

A platform handler answers once. To show tokens as they arrive, forward the events from an HTTP route as server-sent events, or collect them and answer at the end. See [Stream the answer](../tutorial/stream-the-answer.md).
