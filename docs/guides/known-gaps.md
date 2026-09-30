---
title: Known gaps
---

# Known gaps

Intelligence is young, and the fluent API is ahead of some of its providers. This page lists what doesn't work yet, and how to work around it. Mention a workaround in the reviewer's view when you use one.

## Previews in the samples

**`inference()`, `conversations()` and `prompts()` in the trigger context.** The tutorial's intelligent services reach Intelligence through `trigger.context`. The library's `IntelligenceService` doesn't put these into the trigger context yet, and still requires the older `handle(signal)`. The samples carry a small base class and a typed `handler` in `_shared/intelligence-service.ts`. *Workaround elsewhere:* the static entry points, `Intelligence.inference()` and friends.

**Evaluations.** There's no evaluation API in the library. The samples have a small harness (`_shared/evaluation.ts`, `_shared/triage-eval.ts`) built from the fluent API: datasets as JSON, reports as JSON, judges as `check` and `score`.

## Inputs

**Images and PDFs in chat, extract and decisions.** The bundled providers accept text and JSON input only. Text files (`.txt`, `.md`, `.json`, `.csv`, …) are read and sent as text. Binary files are rejected with `AI … does not support file input for this operation`. *Workaround:* convert first, for example extract text from PDFs before calling `extract`, or use a custom provider with vision support.

**Decisions don't read binary files.** `choice`, `check` and `score` only send the name and type of non-text inputs, not their content.

## Capabilities without a provider

**`ocr` and `video`.** The chains exist, no bundled provider implements them. *Workaround:* a [custom provider](./custom-provider.md).

## Tools

**`stream()` doesn't run tools.** Use `ask()` for tool-using calls.

**File inputs are only sent with the first tool round.** Text and JSON inputs, and the question, stay in the history for every round.

## Conversations

**No memory window or compaction yet.** The whole history, including tool calls and results, is sent with every turn. *Workaround:* one conversation per topic or ticket, `clear()` when done, or summarize old turns yourself.

## Local models

**Reasoning models need room.** Models that think before answering (for example Qwen 3 "thinking" variants or `gpt-oss`) spend output tokens on reasoning. With a small `maxTokens`, structured answers arrive empty or cut off: *Structured response … did not match schema*. *Workaround:* a non-reasoning model for decisions (the tutorial's smoke runs used `qwen3-coder-next` in LM Studio), or a larger `maxTokens`.

**Parallel requests while a model loads.** LM Studio can answer `500` to parallel requests while it's still loading a model. `retry` in the AI's `defaults` covers it.

## Platform

**Handlers don't apply Zod defaults.** Platform handlers validate their input against the schema, but pass the input on as it was sent, so `.default(...)` values never arrive. *Workaround:* mark the field `.optional()` and default it in code: `async ({ attachments = [], ...ticket }, trigger) => …`.

## Two generations of API

The package still contains the older `models`, `embeddings`, `agents` and `channels` layers, configured under their own YAML sections. This documentation covers the fluent API over `ais`. Don't mix both in new code.

## Fixed

These gaps from earlier previews are fixed as of `@3flows/intelligence@0.9.0-next.3`:

- Later tool rounds now keep the chain's inputs and question in the history.
- Memory-store conversations keep tool calls and results.
- `choice().oneOf()` and `.manyOf()` results are typed as one value and a list.
- `AIConversation` token totals accumulate instead of being reset every turn.
- Calls through `ais` update the `intelligence_llm_*` and `intelligence_embedding_*` Prometheus counters.
- Nullable schema fields are sent as `anyOf`, so structured output works with LM Studio and llama.cpp.
