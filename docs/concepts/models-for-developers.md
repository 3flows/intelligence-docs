---
title: Models for application developers
---

# Models for application developers

You don't need to know how a language model is trained to build good features with it. You need a mental model that predicts how it behaves when you call it. This page is that mental model, in the terms the rest of the documentation uses.

## A model is a function, with three surprises

From your service's point of view, a model call is a remote function:

```txt
instructions + context + question  ──▶  model  ──▶  answer
```

It's like calling any HTTP API, with three differences you have to design for.

### 1. It's stateless

A model remembers nothing between calls. If it "remembers" what the customer said two messages ago, that's because somebody sent those two messages again with the new question.

That's why Intelligence separates:

- `trigger.context.inference().chat()` is **one call**. Nothing is remembered.
- `trigger.context.conversations().conversation(id)` **stores the history** and sends it with every turn.

Memory is a feature of your application, not of the model. You decide what's kept, where, and for how long. See [Conversations](./conversations.md).

### 2. It's non-deterministic

Ask the same question twice and you can get two different answers. Usually they mean the same thing; sometimes they don't. A few consequences:

- **Don't compare text.** Compare *values*. Ask for a `choice`, a `check` or a `score` and route on `.value`, not on whether the text contains "yes". See [Turning language into data](./language-into-data.md).
- **Lower the temperature for decisions.** `temperature` controls how adventurous the model is. For routing and extraction, `0` is a good default. For drafting replies, a little higher is fine.
- **Tests don't call the model.** Tests check *your* code: that the right prompt, context and tools are sent, and that the answer is handled correctly. The model is replaced by a scripted one. See [Testing](../guides/testing.md).
- **Quality is measured, not asserted.** Whether the model routes tickets *well* is an evaluation question: a set of real examples, run against a real model, compared to what a human would do.

### 3. It can be confidently wrong

A model produces the most plausible continuation of what it was given. If it wasn't given the facts, it will still produce something plausible. That's usually called **hallucination**, and it's the default behavior, not a bug.

The fix is almost never a better prompt. It's better **context**:

- give it the facts it needs (the ticket, the order, the policy), with `.with(...)`,
- let it fetch facts it can't know, with [tools](./tools.md),
- let it search what the company knows, with [retrieval](./retrieval.md),
- and ask for a `reason`, so a human can check the answer against the facts.

## Tokens: the unit of everything

Models don't read characters or words; they read **tokens**, pieces of words. As a rule of thumb, one token is about four characters of English text, and a page of text is about 500 tokens.

Tokens matter for three reasons:

| | What it means for you |
|---|---|
| **Cost** | Providers charge per token, separately for input (what you send) and output (what comes back). Long context in every call adds up. |
| **Latency** | Output tokens are generated one after another. A long answer takes longer. [Streaming](../tutorial/stream.md) shows them as they come. |
| **Limits** | Every model has a **context window**: the maximum number of tokens it can see at once. Instructions, history, documents and the answer all have to fit. |

Every response carries `usage` with `promptTokens`, `completionTokens` and `totalTokens`. With the conversations ontology enabled, every call is also recorded as an `AIInferenceRun`. See [See what it did](../tutorial/see-what-it-did.md).

## What a model is good at, and what it isn't

Good at:

- understanding free text in any language, including badly written text,
- classifying, summarizing, extracting and rephrasing,
- following a well-described procedure,
- choosing which of several tools fits a request.

Not good at, or not to be trusted with alone:

- exact arithmetic and counting,
- facts it hasn't been given,
- anything where "usually right" isn't good enough: payments, legal commitments, deleting data.

A useful rule: **let the model decide what the text means; let your code decide what happens.** The model says "this ticket is about billing, urgent, frustration 8". Your service decides to page the billing team.

## Instructions, context, question

Every call in Intelligence is built from the same three parts:

| Part | Method | Example |
|---|---|---|
| **Instructions**: who the model is and how it should behave | `.instructions(...)` or `.prompt(name)` | *You are a support agent for a bike shop. Be brief and friendly.* |
| **Context**: the material it works on | `.with(...)`, `.withFile(...)`, `.withBlob(...)` | the ticket, the order, a PDF |
| **Question**: the task for this call | `.ask(...)` | *Draft a reply.* |

Keeping them apart is what makes a call reviewable: the instructions are policy, the context is data, the question is the task. See [Context and prompts](./context-and-prompts.md).

## Beyond text

"Language model" is shorthand. The same kind of call covers other **modalities**: turning audio into text (transcription), text into audio (speech), text into images or video, pages into text (OCR), text into vectors (embeddings), and checking content against safety policies (moderation). Intelligence gives each its own capability with the same grammar. See [Modalities](./modalities.md).

## Where to go from here

- [Capabilities and providers](./capabilities-and-providers.md): how a call finds a model.
- [The fluent API](./the-fluent-api.md): the grammar every capability shares.
- [The tutorial](../tutorial/index.md): all of this, one small step at a time.
