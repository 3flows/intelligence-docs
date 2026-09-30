---
title: 4. Swap the model, test without one
---

# 4. Swap the model, test without one

**Where we are:** an intelligent service drafts replies with a versioned prompt.

**The problem:** two questions come up before anyone builds more. *Are we tied to OpenAI?* And *how do we test this?* A test against a real model is slow, costs money, needs a key in CI, and fails randomly because the answers change.

Both have the same answer: **the model is configuration.**

## Swap the model

The service asks for a capability; the YAML names the model. Another provider is a YAML change:

```yaml title="intelligence.yml"
ais:
  - name: DEFAULT
    provider: anthropic
    model: claude-sonnet-4-5
    connection:
      apiKey: ${{ ANTHROPIC_API_KEY }}
```

Or a local model, with no key, no cost and no data leaving the machine. The sample has it as a second file:

```yaml title="intelligence.local.yml"
ais:
  # A local model in LM Studio: no key, no cost, no data leaves the machine.
  - name: DEFAULT
    provider: lmstudio
    model: qwen/qwen3-coder-next     # any model loaded in LM Studio
    capabilities: [structured, tools]
```

```sh
yarn step:04:local
```

The service code didn't change. `capabilities` tells Intelligence what the local model can do, because it can't guess it from the name; see [Local models](../guides/local-models.md).

## Test without a model

A test should check what *we* wrote: that the handler sends the right prompt and the right data, and does the right thing with the answer. Whether the model's answers are *good* is a different question, answered by evaluations in [Part 5](./measure.md).

So tests replace the model the same way we just replaced OpenAI: with a provider. A **scripted** one, which answers what the test tells it to, and records what it was asked. Providers are ordinary registered classes, so it's a small file, and every sample step has used it since step 1.

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

A **script** is a function from request to answer: a string, a structured value, or a full response with tool calls. Every request is recorded, with `ai`, the name of the AI it went to. The full file is in the [testing guide](../guides/testing.md#the-scripted-provider).

Tests shouldn't have their own configuration that drifts from the real one. `runOffline` loads the step's real YAML and changes one thing: every AI's `provider` becomes `scripted`.

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

Services, prompts, AI names and models stay exactly as in production. That's the platform's portability, used for testing: **same code, different YAML.**

## The test

```ts title="step.test.ts"
for (const yaml of ['intelligence.yml', 'intelligence.local.yml']) {
    describe(`Step 04: swap and test (${yaml})`, () => {
        before(() => runOffline(`./steps/04-swap-and-test/${yaml}`));
        after(() => Platform.shutdown());
        beforeEach(() => ScriptedAI.reset());

        test('returns the model’s draft as the reply', async () => {
            ScriptedAI.reset(() => 'Hi Ada, a little squeaking is normal.');
            const { reply } = await post('http://127.0.0.1:3000/draftReply', ticket);
            assert.equal(reply, 'Hi Ada, a little squeaking is normal.');
        });

        test('uses the support.reply prompt, rendered for Velo', async () => { /* … */ });
        test('sends the ticket as input, not as instructions', async () => { /* … */ });

        test('a failing model call is an error of the handler, not a crash', async () => {
            ScriptedAI.reset(() => { throw new Error('rate limited'); });
            await assert.rejects(post('http://127.0.0.1:3000/draftReply', ticket), /failed with 5\d\d/);
        });
    });
}
```

The same four tests run against both YAML files: the swap is tested, too.

## Run it

```sh
yarn test
```

```txt
▶ Step 04: swap and test (intelligence.yml)
  ✔ returns the model’s draft as the reply (8ms)
  ✔ uses the support.reply prompt, rendered for Velo (2ms)
  ✔ sends the ticket as input, not as instructions (2ms)
  ✔ a failing model call is an error of the handler, not a crash (1ms)
▶ Step 04: swap and test (intelligence.local.yml)
  …
```

No key, no network, the same result every time. From here on, every chapter ends with a **Test it** section built this way.

## What you learned

- **The model is configuration.** Providers, local or hosted, are a YAML change.
- **Tests check the call and the handling, not the model.** Assert on `ScriptedAI.requests`; script the answers.
- A provider is a registered class. The tests swap providers the way production swaps databases.

## Reviewer's view

The tests read as the feature's contract: *prompt `support.reply` for Velo, ticket as input, draft as reply, errors reported.* When the next change touches the call, one of these tests should change with it. If none does, ask why.

[Sample: step 04](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/04-swap-and-test) · Next: [Choose](./choose.md)
