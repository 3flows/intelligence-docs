---
title: 0. Hello, model
---

# 0. Hello, model

**Where we are:** an empty project that starts the platform with a model configured, from [Set up a project](./setup.md). Or the samples, if you just want to run the steps.

**Goal:** see how little it takes to put a model behind an API.

## The code

A service with one handler. The handler asks the model and returns the answer.

```ts title="services.ts"
import { Register, Service, handler, t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

@Register()
export class SupportService extends Service {
    handlers = () => [
        handler(
            'ask',
            t.object({ question: t.string() }),
            t.object({ answer: t.string() }),
            async ({ question }, trigger) => {
                // highlight-next-line
                const answer = await Intelligence.inference().chat().ask(question);
                await trigger.ok({ answer: answer.text ?? '' });
            }
        )
    ];
}
```

`Intelligence.inference()` is the entry point for every stateless AI capability. `chat()` is the simplest one: text in, text out. `ask(...)` sends the question and resolves with the answer. `text` can be `undefined` when a model answers with something else, like a tool call. We'll get there.

## The configuration

```yaml title="intelligence.yml"
name: support-desk

services:
  - name: SupportService

https:
  - name: api
    port: 3000
    services:
      - name: SupportService

ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

- `services` and `https` are the platform's: start the service, expose its handlers on port 3000.
- `ais` lists the models. One entry is one **AI**: a name, a provider, a model, and how to connect.

The handler doesn't name a model. It asks for `chat`, and Intelligence picks the AI that can do it, here the only one. That's the idea of the whole library: **code asks for a capability, YAML decides who delivers it.** More in [Capabilities and providers](../concepts/capabilities-and-providers.md).

## Start it

```ts title="main.ts"
import { Intelligence } from '@3flows/intelligence';
import './services.js';

await Intelligence.run('./steps/00-hello-model/intelligence.yml');
```

That's the path in the samples, where every step has its own folder. In your own project it's `./intelligence.yml`.

## Run it

```sh
export OPENAI_API_KEY=<your key>
yarn step:00
curl -X POST localhost:3000/ask -H 'Content-Type: application/json' \
  -d '{"question":"My new bike squeaks when I brake. What can I do?"}'
```

```json
{ "answer": "Squeaky brakes are common on new bikes. Usually the pads need to bed in: …" }
```

The answer will be different for you, and different each time you ask. That's normal for a model; see [Models for application developers](../concepts/models-for-developers.md#2-its-non-deterministic).

## Try another model

Change two lines:

```yaml
ais:
  - name: DEFAULT
    provider: ollama     # a local model, no key
    model: llama3.1
```

Run it again. The service code didn't change. [Local models](../guides/local-models.md) lists the YAML for every provider.

## What you learned

- **A model call is a line in a handler.** `Intelligence.inference().chat().ask(question)`.
- **`ais` in YAML decides which model answers**, and the code asks for a capability, not a vendor.
- The answer is in `answer.text`; `answer.usage` counts the tokens.

## Reviewer's view

One handler that forwards a question to a model. Two things to see: the model is `gpt-4.1-mini` at OpenAI, so questions leave our system to OpenAI; and anyone who can reach the API can spend tokens. For a demo that's fine. For production, the `https` configuration needs authentication.

[Sample: step 00](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/00-hello-model) · Next: [Give it a job](./give-it-a-job.md)
