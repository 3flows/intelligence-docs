---
title: 1. An intelligent service
---

# 1. An intelligent service

**Where we are:** an empty project that starts the platform with a model configured, from [Set up a project](./setup.md). Or the samples, if you just want to run the steps.

**Goal:** see how little it takes to put a model behind an API.

## The code

On the platform, a service reaches everything it uses through its trigger context: `doc()` for documents, `mq()` for queues, `service()` for other services. An **intelligent service** adds three things to that context: `inference()`, `conversations()` and `prompts()`.

```ts title="services.ts"
import { Register, t } from '@3flows/platform';
import { IntelligenceService, handler } from '../_shared/intelligence-service.js';

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler(
            'ask',
            t.object({ question: t.string() }),
            t.object({ answer: t.string() }),
            async ({ question }, trigger) => {
                // highlight-start
                const { inference } = trigger.context;
                const answer = await inference().chat().ask(question);
                // highlight-end
                await trigger.ok({ answer: answer.text ?? '' });
            }
        )
    ];
}
```

- **`extends IntelligenceService`** makes the service intelligent. Everything else about it is a platform service: `@Register()`, handlers, schemas, `trigger.ok(...)`.
- **`inference()`** is the entry point for every stateless AI capability. `chat()` is the simplest one: text in, text out.
- **`ask(...)`** sends the question and resolves with the answer. `text` can be `undefined` when a model answers with something else, like a tool call; we'll get there in chapter 11.

`IntelligenceService` and `handler` come from the samples' `_shared` folder for now; see [the note on the preview](./index.md#the-samples).

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

await Intelligence.run('./steps/01-intelligent-service/intelligence.yml');
```

That's the path in the samples, where every step has its own folder. In your own project it's `./intelligence.yml`.

## Run it

```sh
export OPENAI_API_KEY=<your key>
yarn step:01
curl -X POST localhost:3000/ask -H 'Content-Type: application/json' \
  -d '{"question":"My new bike squeaks when I brake. What can I do?"}'
```

```json
{ "answer": "Squeaky brakes are common on new bikes. Usually the pads need to bed in: …" }
```

The answer will be different for you, and different each time you ask. That's normal for a model; see [Models for application developers](../concepts/models-for-developers.md#2-its-non-deterministic).

## Test it

The step's test sends a question and checks what reached the model, without calling one:

```ts title="step.test.ts"
test('sends the question as it is, to the DEFAULT AI', async () => {
    await post('http://127.0.0.1:3000/ask', { question: 'My new bike squeaks when I brake.' });

    const [request] = ScriptedAI.requests;
    assert.equal(request.ai, 'DEFAULT');
    assert.deepEqual(request.inputs, [{ type: 'text', text: 'My new bike squeaks when I brake.' }]);
});
```

How that works, with no model and no key, is chapter 4. Until then, `yarn test` already runs it.

## What you learned

- **An intelligent service reaches the model through its trigger context**, like everything else: `trigger.context.inference()`.
- **`ais` in YAML decides which model answers.** The code asks for a capability, not a vendor.
- The answer is in `answer.text`; `answer.usage` counts the tokens.

## Reviewer's view

One handler that forwards a question to a model. Two things to see: the model is `gpt-4.1-mini` at OpenAI, so questions leave our system to OpenAI; and anyone who can reach the API can spend tokens. For a demo that's fine. For production, see [Going live](./going-live.md).

[Sample: step 01](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/01-intelligent-service) · Next: [Anatomy of a call](./anatomy-of-a-call.md)
