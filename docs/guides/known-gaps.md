---
title: Known gaps
---

# Known gaps

This page lists what doesn't work yet in `@3flows/intelligence@0.9.0-next.5`, and how to work around it. Mention a workaround in the reviewer's view when you use one.

## Chatbots and agents

**Chatbot retention isn't automatic.** Sessions are kept until they're deleted, with `session(id).delete()` or `DELETE /conversation/:id`.

**A chatbot's tools can't be scoped per call.** They get what the model passes. Tools that must be limited to one user's data belong in a service that knows the user.

## Workflows

**Value resolvers of service and agent steps aren't typed.** In `s.service(…).input(({ input }) => …)` and `s.agent(…).input(…)`, annotate the parameter: `({ input }: { input: Intake }) => …`. `s.map(...)` and the predicate of `when(...)` are typed.

**No YAML section.** Workflows are defined in code and registered by a service.

## Inputs

**Binary files.** Whether an image or a PDF can be sent depends on the provider and the operation. Where it can't, the call fails with `AI … does not support file input for this operation`. Text files (`.txt`, `.md`, `.json`, `.csv`, …) are read and sent as text. *Workaround:* convert first, for example extract the text of a PDF before calling `extract`.

**Decisions don't read binary files.** `choice`, `check` and `score` send the name and type of non-text inputs, not their content.

## Capabilities without a bundled provider

**`ocr` and `video`.** The chains exist; no bundled provider implements them. *Workaround:* a [custom provider](./custom-provider.md).

## Providers

**Anthropic: streaming with tools or a response schema fails**, with a clear error. Use `.answer()` for those calls.

## Evaluations

There's no evaluation API in the library. The samples have a small harness (`_shared/evaluation.ts`, `_shared/triage-eval.ts`) built from the fluent API: datasets as JSON, reports as JSON, judges as `check` and `score`.

## Versions

**Intelligence names the exact Platform version it needs.** `@3flows/intelligence@0.9.0-next.5` depends on `@3flows/platform@0.9.0-next.31`. An application that asks for another Platform version gets two Platforms in `node_modules`, and services registered in one aren't found by the other. Pin both.

## Local models

**Reasoning models need room.** Models that think before answering spend output tokens on reasoning. With a small `maxTokens`, structured answers arrive empty or cut off: *Structured response … did not match schema*. *Workaround:* a non-reasoning model for decisions, or a larger `maxTokens`.

**Parallel requests while a model loads.** LM Studio can answer `500` to parallel requests while it's still loading a model. `retry` in the AI's `defaults` covers it.

## Platform

**Entity queries return ten records by default.** `find(...).all()` on a domain entity returns the first ten. In your own queries on the Intelligence domains, use `.limit(0)` to read all records.

**Handlers don't apply Zod defaults.** Platform handlers validate their input against the schema, but pass the input on as it was sent, so `.default(...)` values never arrive. *Workaround:* mark the field `.optional()` and default it in code: `async ({ attachments = [], ...ticket }, trigger) => …`.
