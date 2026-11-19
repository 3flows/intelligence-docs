---
title: What's next
---

# What's next

You built an AI support desk, in seven parts:

1. **An intelligent service** that reaches the model through its trigger context, with prompts as versioned configuration, on any model, tested without one.
2. **Tickets turned into data**: routed, tagged, flagged, scored and extracted, with business rules in code.
3. **A chat** on every ticket, with its history as the desk's own record, streamed, that looks up the customer's orders.
4. **Knowledge**: attachments, a help center searched by meaning, reranked, and cited.
5. **Quality**: an evaluation set, improvements with numbers before and after, judges for free text, guardrails before and after the model, and people for everything uncertain, whose corrections feed the evaluation.
6. **Production**: one model per job, work off the request path, a record of every call, and a production configuration that can't drift.
7. **Beyond one call**: a chatbot for the shop's website, an agent that prepares cases for the team, and the intake of a ticket as a workflow.

Look back at where the code grew. The calls to the model stayed short: a capability, some context, a question, a verb. What grew was `triage.ts` (the decisions, in words), `rules.ts` (what we do with them), `judges.ts` and `guardrails.ts` (the red lines), the evaluation sets (what *good* means), and YAML. That's the split this library is built around: **the model decides what the text means; your code decides what happens; evaluations say how well it works.**

## Coming next in this tutorial

These chapters are in preparation:

- **Voicemail tickets:** `transcriber()` turns a voice message into a ticket, `speech()` reads the confirmation back.
- **Approval for refunds:** the assistant proposes a refund, and a workflow waits for a human decision before anything is paid.
- **Evaluations in CI:** a nightly run against the production models, failing when a metric drops below its baseline.

## Learn more

- [Why 3flows Intelligence](../why.md)
- [Models for application developers](../concepts/models-for-developers.md)
- [Turning language into data](../concepts/language-into-data.md)
- [Owning an AI feature](../concepts/responsibility.md)
- [Fluent API reference](../api/overview.md)
- [Configuration reference](../configuration/overview.md)
- [What's new in 0.9](../whats-new-0.9.md) and [Migrating from 0.8](../migration-0.8-to-0.9.md)
- [Known gaps](../guides/known-gaps.md)
