---
title: What's next
---

# What's next

You built an AI support desk, in six parts:

1. **An intelligent service** that reaches the model through its trigger context, with prompts as versioned configuration, on any model, tested without one.
2. **Tickets turned into data**: routed, tagged, flagged, scored and extracted, with business rules in code.
3. **A conversation** per ticket, streamed, that looks up the customer's orders.
4. **Knowledge**: attachments, a help center searched by meaning, reranked, and cited.
5. **Quality**: an evaluation set, improvements with numbers before and after, judges for free text, guardrails before and after the model, and people for everything uncertain, whose corrections feed the evaluation.
6. **Production**: one model per job, work off the request path, a record of every call, and a production configuration that can't drift.

Look back at where the code grew. The calls to the model stayed short: a capability, some context, a question. What grew was `triage.ts` (the decisions, in words), `rules.ts` (what we do with them), `judges.ts` and `guardrails.ts` (the red lines), the evaluation sets (what *good* means), and YAML. That's the split this library is built around: **the model decides what the text means; your code decides what happens; evaluations say how well it works.**

## Coming next in this tutorial

These chapters are in preparation:

- **Voicemail tickets:** `transcriber()` turns a voice message into a ticket, `speech()` reads the confirmation back.
- **Approval for refunds:** the assistant proposes a refund, a platform [flow](https://3flows.github.io/platform-docs/docs/tutorial/flows) waits for a human decision.
- **Evaluations in CI:** a nightly run against the production models, failing when a metric drops below its baseline.

## Learn more

- [Why 3flows Intelligence](../why.md)
- [Models for application developers](../concepts/models-for-developers.md)
- [Turning language into data](../concepts/language-into-data.md)
- [Owning an AI feature](../concepts/responsibility.md)
- [Fluent API reference](../api/overview.md)
- [Configuration reference](../configuration/overview.md)
- [Known gaps](../guides/known-gaps.md)
