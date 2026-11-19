---
title: 1. Configure AIs
---

# 1. Configure AIs

Start with `ais:`. This is the inventory of model capabilities your application may use.

AIs are deliberately boring configuration: provider, model, credentials, capabilities, defaults, labels. They do not contain business logic.

## Starter example

```yaml title="starter/intelligence.yml"
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

For production, add defaults so every call is bounded even when a developer forgets a per-call timeout:

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      timeoutMs: 10000
      retry:
        attempts: 2
        backoffMs: 500
```

## Multiple AIs

Use multiple AIs when different jobs need different models or capabilities:

```yaml
ais:
  - name: chat
    provider: openai
    model: gpt-4.1-mini
    capabilities: [chat, structured, tools]

  - name: embedding
    provider: openai
    model: text-embedding-3-small
    capabilities: [embedding]

  - name: moderation
    provider: openai
    model: omni-moderation-latest
    capabilities: [moderation]
```

Then select them explicitly when needed:

```ts
await trigger.context.inference().chat().model('chat').ask(question);
await trigger.context.inference().embedding().model('embedding').with(text).embed();
```

## Inspect what is configured

In scripts/tests you can inspect the active runtime:

```ts
const ai = Intelligence.inference().select('chat').describe();
console.log(ai.name, ai.model, ai.capabilities);
```

Inside services, use the trigger context:

```ts
const ai = trigger.context.ai(undefined, 'chat').describe();
```

## What not to put here

Do not put persona, business policy, tool choices, or customer data in `ais:`. Those belong to prompts, services, chatbots, agents, or workflow steps.

Next: [call the model from application code](./02-inference.md).
