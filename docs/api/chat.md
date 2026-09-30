---
title: chat()
---

# `chat()`

One stateless call: instructions, input and a question in, text out. Requires the `chat` capability, `tools` when tools are attached, and `streaming` for `.stream(...)`.

```ts
const answer = await Intelligence.inference()
    .chat()
    .prompt('support.reply', { shop: 'Velo Bikes' })
    .with(ticket)
    .ask('Draft a reply to this ticket.');

answer.text;    // the reply
answer.usage;   // { promptTokens, completionTokens, totalTokens }
```

## Methods

In addition to the [shared methods](./overview.md#methods-shared-by-all-chains):

| Method | Description |
|---|---|
| `.messages(messages: AIMessage[])` | Prepend explicit history: `{ role: 'user' \| 'assistant' \| 'system' \| 'tool', content }` |
| `.inputs(inputs: AIInput[])` | Add already normalized inputs |
| `.service(service, method, options?)` | Offer a platform service handler as a tool. See [Tools](./tools.md) |
| `.services(definitions)` | Offer several service handlers |
| `.tools(...tools: InferenceTool[])` | Offer inline tools |
| `.skills(...names: string[])` | Offer the tools of configured skills |
| `.maxToolRounds(rounds: number)` | Maximum tool rounds before returning. Default `3` |

## Terminal verbs

### `.ask(prompt: string): Promise<AIChatResponse>`

Sends the call. If the model requests tools, runs them and calls the model again, up to `maxToolRounds`. Resolves with the final answer.

### `.stream(prompt: string): Promise<AsyncIterable<AIStreamEvent>>`

Sends the call and resolves with a stream of events. Note the `await` before iterating:

```ts
for await (const event of await chat.stream('Draft a reply.')) {
    if (event.type === 'text.delta') process.stdout.write(event.text);
    if (event.type === 'done') console.log(event.response.usage);
}
```

`stream` doesn't run tools. See [Results and streams](./results-and-streams.md) for all event types.

## What the model receives

In order:

1. one system message with all `instructions`, then all rendered `prompt`s, joined by blank lines,
2. the `messages`,
3. one user message per input, in the order of `with` / `withFile` / `withBlob`,
4. the question as the last user message.

## Examples

**A reusable chain**

```ts
const replies = Intelligence.inference().chat().prompt('support.reply').options({ temperature: 0.3 });
const draft = await replies.with(ticket).ask('Draft a reply.');
```

**Existing history**

```ts
await Intelligence.inference()
    .chat()
    .messages([
        { role: 'user', content: 'My brakes squeak.' },
        { role: 'assistant', content: 'Which bike model is it?' }
    ])
    .ask('A Velo City 3.');
```

**A specific model and provider options**

```ts
await Intelligence.inference()
    .chat()
    .model('reasoning')
    .options({ raw: { reasoning_effort: 'high' } })
    .with(contract)
    .ask('List every clause that deviates from our standard terms.');
```

## See also

- [Conversations](./conversations.md): the same chain, with history.
- [Tools](./tools.md): letting the model call your services.
