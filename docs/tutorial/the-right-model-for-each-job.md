---
title: 22. The right model for each job
---

# 22. The right model for each job

**Where we are:** a complete, measured and guarded desk, all on one chat model.

**The problem:** the monthly bill arrives. Five triage calls per ticket, and two guardrail checks and a judge per chat turn, go to the same model that writes the replies, although picking one of three departments doesn't need it. Meanwhile, the team would like better replies, which would need a *bigger* model. One model for everything is too big for some jobs and too small for others.

## The solution: several AIs, one per job

Jobs differ in what they need:

| Job | Needs | Doesn't need |
|---|---|---|
| Triage, checks, judges | speed, low cost, consistency | eloquence |
| Chat and replies | quality, tone, tool use | the lowest price |
| Embeddings, reranking | a specialized model | — |

So the YAML gets one AI per job, each with its own defaults:

```yaml title="intelligence.yml"
ais:
  # Conversations and replies: the best model we're willing to pay for.
  - name: DEFAULT
    provider: openai
    model: gpt-4.1
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      temperature: 0.3
      maxTokens: 600

  # highlight-start
  # Triage, guardrail checks and judges: small, fast, and as deterministic as it gets.
  - name: triage
    provider: openai
    model: gpt-4.1-nano
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      temperature: 0
      maxTokens: 300
  # highlight-end

  - name: embeddings
    # … as before
  - name: reranker
    # … as before
```

And triage, the checks and the judges ask for it by name:

```ts title="triage.ts"
/** The AI for all triage questions. Which model that is, is decided in YAML. */
export const TRIAGE = 'triage';

const [department, topics, urgent, frustration, facts] = await Promise.all([
    // highlight-next-line
    ai.choice('department').model(TRIAGE).prompt('support.routing').oneOf(departments).with(text).ask('Which team should handle this ticket?'),
    ai.choice('topics').model(TRIAGE).manyOf(Topic.options).with(text).ask('Which topics does this ticket mention?'),
    ai.check('urgent').model(TRIAGE).with(text).ask('…'),
    ai.score('frustration').model(TRIAGE).between(0, 10).criteria(...frustrationScale).with(text).ask('How frustrated is the customer?'),
    withAttachments(ai.extract('facts').model(TRIAGE).schema(Facts).with(text), ticket).ask('Extract the facts of this ticket.')
]);
```

```ts title="guardrails.ts, judges.ts"
ai.check('payment-details').model(TRIAGE)…
context.inference().check('promises').model(TRIAGE)…
context.inference().check('grounded').model(TRIAGE)…
```

`.model(name)` is a business decision in code (*"triage runs on the triage AI"*); what that AI *is* stays a YAML decision. Everything without `.model(...)` keeps using `DEFAULT`, or the only AI with the capability.

## Swapping models is a YAML change

The team wants to try Claude for replies. That's the `DEFAULT` entry:

```yaml
  - name: DEFAULT
    provider: anthropic
    model: claude-sonnet-4-5
    connection:
      apiKey: ${{ ANTHROPIC_API_KEY }}
    defaults:
      temperature: 0.3
      maxTokens: 600
```

And triage on a native decision model, with calibrated probabilities:

```yaml
  - name: triage
    provider: typesafe
    model: jev-latest
    connection:
      apiKey: ${{ TYPESAFE_API_KEY }}
```

`choice().oneOf()`, `check()` and `score()` use it natively. But `manyOf` and `extract` need `structured`, which `jev` doesn't have, so they'd fail with *AI triage does not support capability structured*. The capability system tells you before production does. Keep `extract` on a chat model: give it its own AI, or leave its `.model(...)` off.

And for development, without a key:

```yaml
  - name: DEFAULT
    provider: ollama
    model: llama3.1
    capabilities: [structured, tools]
```

The code doesn't change for any of these.

## Let the evaluation decide

A new model is a behavior change, even when the tests pass: the tests don't call a model. Is the small model good enough for triage? Part 5 built the tool to answer that. `yarn eval:22` runs the triage evaluation with the new YAML and compares with the report from chapter 17:

```sh
OPENAI_API_KEY=<key> yarn eval:22
# locally: the same large model for replies, a smaller one for triage
LOCAL_MODEL=qwen/qwen3-coder-next LOCAL_MODEL_TRIAGE=openai/gpt-oss-20b yarn eval:22
```

This is what it said when we tried a smaller local model for triage, `gpt-oss-20b`, next to `qwen3-coder-next` for replies:

```txt
Triage evaluation: 30 cases, 19 failed (counted as wrong)
  ai DEFAULT: qwen/qwen3-coder-next (LM Studio)
  ai triage: openai/gpt-oss-20b (LM Studio)
  prompt support.routing@v1
  …

  department      33%   10/30   (was 97%)
  urgent          10%    3/30   (was 100%)
  orderNumber     27%    8/30   (was 100%)

  Mismatches:
  - t05 orderNumber: expected "A-2005", got "A-2000"
  - t07 *: expected "an answer", got "error"
      Unterminated string in JSON at position 76 (line 1 column 77)
  - t17 urgent: expected false, got true
      We need to calculate or determine the size.
  …
```

A clear no. The smaller model is a reasoning model: it spends its output budget thinking, and 19 of 30 structured answers were cut off mid-JSON. Where it did answer, it marked almost everything urgent, and its reasons show why: *"We need to calculate or determine the size."* is its own plan, not a reason. Without the evaluation, this would have looked like a cost saving until the first week of tickets.

That's the point of the chapter: **cheaper is a hypothesis, the evaluation tests it.** Run the same comparison for the model you actually consider, `gpt-4.1-nano` in the YAML above, before you switch. If it holds up, it saves most of the triage cost; if not, the report shows which question needs the bigger model, and only that one keeps it. Because every question names its AI, that's a one-line change per question.

## Test it

```ts title="step.test.ts"
test('triage, checks and judges run on the triage AI; only the reply runs on DEFAULT', async () => {
    const { id } = await createTicket();
    assert.ok(ScriptedAI.requests.every((request) => request.ai === 'triage'));

    ScriptedAI.reset(triageScript(safe, 'Happy to help.'));
    await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Which pads do I need?' });

    const byAi = ScriptedAI.requests.map((r) => `${r.responseSchemaName ?? 'reply'}@${r.ai}`).sort();
    assert.deepEqual(byAi, ['grounded@triage', 'payment-details@triage', 'promises@triage', 'reply@DEFAULT']);
});
```

## What you learned

- **One AI per job**, each with its own model and defaults.
- **`.model(name)` in code names the job; YAML decides the model.**
- Capabilities make incompatible swaps fail loudly and early; **evaluations decide** whether a compatible swap is good enough.

## Reviewer's view

> Triage, guardrail checks and judges run on `gpt-4.1-nano` at temperature 0; replies on `gpt-4.1`.

The code change is one `.model(TRIAGE)` per question. The decision to review is in YAML, and it needs the evaluation report next to it: no model change without numbers.

[Sample: step 22](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/22-model-per-job) · Next: [Don't block, expect failure](./dont-block.md)
