---
title: Owning an AI feature
---

# Owning an AI feature

Somebody has to be able to say: *this feature is good enough, it's safe, it can go to production.* For AI features, that's harder than for ordinary code, because part of the behavior isn't in the code. This page collects what that person needs.

## Five questions for every AI feature

| Question | Where the answer is |
|---|---|
| **What does the model get?** | The chain: `prompt`, `instructions`, `with` |
| **What may the model do?** | The chain: `service`, `tools`, `skills` |
| **What happens with the answer?** | Your code after the terminal verb |
| **Which vendor sees our data?** | YAML: `ais` |
| **How do we know it works?** | Tests for the code, evaluations for the model |

If every AI call in a change can be answered from those places, the change is reviewable.

## Tests and evaluations are different things

**Tests** check your code, deterministically, on every commit, without a model:

- the right prompt, input and tools are sent,
- the answer is handled correctly, including the unexpected ones: `other`, low confidence, an empty extraction, a failed call.

The tutorial's tests use a scripted provider for exactly this. See [Testing](../guides/testing.md).

**Evaluations** check the model's quality, with a real model, on a set of real examples:

- 50 real tickets with the department a human chose,
- run through `choice('department')`,
- and counted: how many match?

Run them when you change a prompt, a model or a provider. A model change without an evaluation is an untested change.

## Humans in the loop

Not every decision should be automatic. A few shapes, from lightest to strongest:

- **Suggest, don't act.** The model drafts the reply; the agent sends it.
- **Act when sure.** Route automatically above a confidence threshold, queue for a human below it.
- **Act reversibly.** Tag and prioritize automatically, because it's easy to undo. Refunds are not.
- **Wait for approval.** For anything irreversible, let the model propose and a [flow](https://3flows.github.io/platform-docs/docs/tutorial/flows) wait for a human decision.

## Guardrails

- **Moderation** screens content against safety categories before it reaches the model or the customer. See [Guardrails](../tutorial/guardrails.md).
- **Keep customer text in input.** Never concatenate it into instructions. See [Context and prompts](./context-and-prompts.md#why-keep-policy-and-data-apart).
- **Scope tools to the caller.** A tool must check permissions itself; the model passes whatever the user typed.
- **Validate decisions like input.** A `choice` is always one of its options; a free-text answer used as an id is not.

## Observability

In production, you need to answer *"why did it say that?"* and *"what does it cost?"*:

- A **tracer** records every model call as a span with inputs and outputs. See [Observability](../guides/observability.md).
- The **conversations ontology** records every inference run with tokens, latency, model and prompt versions, as queryable entities.
- **Labels and metadata** on chains tie calls to your domain: `.labels('triage').metadata({ ticketId })`.

## Personal data

AI features move personal data to new places: the model provider, the conversation store, the vector index, the traces. For each, know what's stored, where, and for how long.

## See also

- [Why 3flows Intelligence](../why.md)
- [Known gaps](../guides/known-gaps.md)
