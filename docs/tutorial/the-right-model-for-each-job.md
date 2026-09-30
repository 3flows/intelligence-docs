---
title: 17. The right model for each job
---

# 17. The right model for each job

**Where we are:** a complete desk: triage, chat with tools and the help center, embeddings and a reranker.

**The problem:** the monthly bill arrives. Five triage calls per ticket go to the same model that writes the replies, although picking one of three departments doesn't need it. Meanwhile, the team would like better replies, which would need a *bigger* model. One model for everything is too big for some jobs and too small for others.

## The solution: several AIs, one per job

Jobs differ in what they need:

| Job | Needs | Doesn't need |
|---|---|---|
| Triage decisions | speed, low cost, consistency | eloquence |
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
      retry: { attempts: 3, backoffMs: 1000 }

  # highlight-start
  # Triage: small, fast, and as deterministic as it gets.
  - name: triage
    provider: openai
    model: gpt-4.1-nano
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      temperature: 0
      maxTokens: 300
      retry: { attempts: 3, backoffMs: 1000 }
  # highlight-end

  - name: embeddings
    # … as before
  - name: reranker
    # … as before
```

And triage asks for it by name:

```ts title="triage.ts"
/** The AI for all triage questions. Which model that is, is decided in YAML. */
const TRIAGE = 'triage';

const [department, topics, urgent, frustration, facts] = await Promise.all([
    // highlight-next-line
    ai.choice('department').model(TRIAGE).oneOf(departments).with(text).ask('Which team should handle this ticket?'),
    ai.choice('topics').model(TRIAGE).manyOf(Topic.options).with(text).ask('Which topics does this ticket mention?'),
    ai.check('urgent').model(TRIAGE).with(text).ask('…'),
    ai.score('frustration').model(TRIAGE).between(0, 10).criteria(...frustrationScale).with(text).ask('How frustrated is the customer?'),
    withAttachments(ai.extract('facts').model(TRIAGE).schema(Facts).with(text), ticket).ask('Extract the facts of this ticket.')
]);
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

## Change models with an evaluation

A new model is a behavior change, even when the tests pass: the tests don't call a model. Before switching `triage` in production, run the fifty tickets from last month through both models and compare the departments with what the team chose. See [Tests and evaluations](../concepts/responsibility.md#tests-and-evaluations-are-different-things).

## What you learned

- **One AI per job**, each with its own model and defaults.
- **`.model(name)` in code names the job; YAML decides the model.**
- Capabilities make incompatible swaps fail loudly and early.

## Reviewer's view

> Triage runs on `gpt-4.1-nano` at temperature 0; replies and chat on `gpt-4.1`.

The code change is one `.model('triage')` per question. The decision to review is in YAML: which model per job, and whether an evaluation backs it.

[Sample: step 17](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/17-models-per-job) · Next: [Guardrails](./guardrails.md)
