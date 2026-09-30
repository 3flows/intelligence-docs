---
title: What's next
---

# What's next

You built an AI support desk with:

- a model behind an API, and prompts as versioned configuration
- offline tests that check the calls and the handling, not the model
- tickets routed, tagged, flagged, scored and extracted into typed data
- triage in the background, with retries and a failure state
- a chat per ticket with a stored history, streamed to the browser
- an order lookup the model can use, scoped to the customer
- attachments from `blobs` in every call
- a help center searched by meaning, reranked, and cited in answers
- one model per job, swappable in YAML
- moderation, policy checks and confidence gates, with humans for the rest
- a record of every model call, with its cost and its prompt version

Look back at where the code grew. The calls to the model stayed short: a capability, some context, a question. What grew was `triage.ts` (the decisions, in words), `guardrails.ts` (the red lines), and ordinary service code that decides what happens with an answer. And YAML: models, prompts, stores, tracers. That's the split this library is built around: **the model decides what the text means; your code decides what happens.**

## Coming next in this tutorial

These chapters are in preparation:

- **Voicemail tickets:** `transcriber()` turns a voice message into a ticket, `speech()` reads the confirmation back.
- **Approval for refunds:** the assistant proposes a refund, a platform [flow](https://3flows.github.io/platform-docs/docs/tutorial/flows) waits for a human decision.
- **Evaluations:** a set of real tickets, run against a model, scored against the team's decisions, before every model or prompt change.
- **Going to production:** MongoDB for conversations, Redis or MongoDB for vectors, authentication on the API.

## Learn more

- [Why 3flows Intelligence](../why.md)
- [Models for application developers](../concepts/models-for-developers.md)
- [Turning language into data](../concepts/language-into-data.md)
- [Owning an AI feature](../concepts/responsibility.md)
- [Fluent API reference](../api/overview.md)
- [Configuration reference](../configuration/overview.md)
- [Known gaps](../guides/known-gaps.md)
