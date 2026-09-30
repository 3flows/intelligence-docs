---
title: 3. Test without a model
---

# 3. Test without a model

**Where we are:** two handlers, a prompt in YAML, and a real model behind them.

**The problem:** how do we test this? A test against the real model is slow, costs money, needs a key in CI, and fails randomly because the answers change.

## The solution: test your code, not the model

A test should check what *we* wrote: that the handler sends the right prompt and the right data, and does the right thing with the answer. The model's quality is a different question, answered by [evaluations](../concepts/responsibility.md#tests-and-evaluations-are-different-things).

So the tests replace the model with a **scripted** one: a provider that answers what the test tells it to, and records what it was asked. Providers are ordinary registered classes, so this is a small file, and every sample step has used it since step 0.

### The scripted provider

```ts title="_shared/scripted-ai.ts (excerpt)"
@Register('scripted', 'ai')
export class ScriptedAI extends AI {
    static script: Script = () => 'OK';
    static requests: Array<AIChatRequest & { ai: string }> = [];

    static reset(script: Script = () => 'OK'): void {
        ScriptedAI.script = script;
        ScriptedAI.requests = [];
    }

    protected async doChat(request: AIChatRequest): Promise<AIChatResponse> {
        ScriptedAI.requests.push({ ...request, messages: [...request.messages], ai: this.configuration.name });
        const answer = ScriptedAI.script(request);
        if (typeof answer === 'string') return { text: answer, usage: ScriptedAI.usage };
        if ('text' in answer || 'toolCalls' in answer) return { usage: ScriptedAI.usage, ...answer } as AIChatResponse;
        return { text: JSON.stringify(answer), parsed: answer, usage: ScriptedAI.usage };
    }

    // … doStream, doEmbed, doRerank, doModerate: see the testing guide
}
```

A **script** is a function from request to answer: a string, a structured value, or a full response with tool calls. Each recorded request also carries `ai`, the name of the AI it was sent to. The full file is in the [testing guide](../guides/testing.md#the-scripted-provider).

### The real YAML, with every AI scripted

Tests shouldn't have their own configuration that drifts from the real one. `runOffline` loads the step's YAML and changes one thing: every AI's `provider` becomes `scripted`.

```ts title="_shared/offline.ts"
export async function runOffline(path: string): Promise<void> {
    await Platform.run({
        load: async () => {
            const yaml = Configuration.parse(await readFile(path, 'utf8')).toJSON() as any;
            yaml.ais = (yaml.ais ?? []).map((ai: any) => ({ ...ai, provider: 'scripted', connection: {} }));
            return new Configuration(yaml);
        }
    });
}
```

Services, prompts, names and models stay exactly as in production. That's the platform's portability, used for testing: **same code, different YAML.**

## The test

```ts title="step.test.ts"
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Platform } from '@3flows/platform';
import { post } from '../_shared/test-helpers.js';
import { runOffline } from '../_shared/offline.js';
import { ScriptedAI } from '../_shared/scripted-ai.js';
import './services.js';

describe('step 03: test without a model', () => {
    before(() => runOffline('./steps/03-test-without-a-model/intelligence.yml'));
    after(() => Platform.shutdown());
    beforeEach(() => ScriptedAI.reset());

    test('returns the model’s draft as the reply', async () => {
        ScriptedAI.reset(() => 'Hi Ada, a little squeaking is normal.');

        const { reply } = await post('http://127.0.0.1:3000/draftReply', ticket);

        assert.equal(reply, 'Hi Ada, a little squeaking is normal.');
    });

    test('uses the support.reply prompt, rendered for Velo', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);

        const [request] = ScriptedAI.requests;
        assert.match(String(request.instructions), /support team of Velo, a bike shop/);
    });

    test('sends the ticket as input, not as instructions', async () => {
        await post('http://127.0.0.1:3000/draftReply', ticket);

        const [request] = ScriptedAI.requests;
        assert.deepEqual(request.inputs?.[0], { type: 'json', value: ticket });
        assert.doesNotMatch(String(request.instructions), /squeak/);
    });
});

const ticket = { email: 'ada@example.com', subject: 'Brakes squeak', body: 'My new bike squeaks when I brake.' };
```

Three tests, three things we decided: the answer is returned, the right policy is used, and customer data stays out of the instructions. The sample adds a fourth: when the model call fails, the handler answers with an error instead of crashing the process.

## Run it

```sh
yarn test
```

```txt
▶ step 03: test without a model
  ✔ returns the model’s draft as the reply (8ms)
  ✔ uses the support.reply prompt, rendered for Velo (2ms)
  ✔ sends the ticket as input, not as instructions (2ms)
```

No key, no network, the same result every time. The step's code is unchanged from step 02; this chapter only adds tests.

## What you learned

- **Tests check the call and the handling, not the model.** Assert on `ScriptedAI.requests`; script the answers.
- **A provider is a registered class**, and YAML picks it. The tests swap providers the way production swaps databases.
- **Model quality is an evaluation**, run deliberately with a real model, not on every commit.

## Reviewer's view

The tests read as the feature's contract: *prompt `support.reply` for Velo, ticket as input, draft as reply.* When the next change touches the call, one of these tests should change with it. If none does, ask why.

[Sample: step 03](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/03-test-without-a-model) · Next: [Route tickets](./route-tickets.md)
