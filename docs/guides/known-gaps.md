---
title: Known gaps
---

# Known gaps

This page tracks current 0.9 limitations. Older documentation and tutorial chapters may still mention 0.8-era conversations; for new apps use the concepts in [What's new in 0.9](../whats-new-0.9.md).

## Samples and tutorial drift

The `starter/` sample has been updated to the 0.9 surfaces: library-exported `IntelligenceService`, `handler`, `tool`, `chatbots`, `skills`, `agents`, and workflows.

Some support-desk tutorial chapters still show legacy `conversations()` and `AIConversation*` examples. Treat those chapters as historical until they are rewritten around chatbots. Use the [migration guide](../migration-0.8-to-0.9.md) when adapting them.

## Evaluations

There is still no full product-level evaluation service in the library. The samples use a small app-local harness built from Fluent inference: datasets as JSON, reports as JSON, and judges as `check` / `score` calls. For deterministic unit tests, prefer `@3flows/intelligence/testing` (`ScriptedAI`, `runOffline`, `expectPrompt`, `collectStream`).

## Inputs

Provider support varies by capability and modality. The chains exist for `chat`, `extract`, `choice`, `check`, `score`, `embedding`, `reranker`, `transcriber`, `speech`, `image`, `ocr`, `moderation`, and `video`, but not every bundled provider implements every capability.

- Binary file support depends on the selected provider and capability.
- OCR/video may require a custom provider until a configured AI advertises those capabilities.
- Decision chains should generally receive text or structured text context, not raw binary data.

## Provider combinations

Anthropic streaming with tools or response schemas currently fails clearly instead of silently degrading. Use non-streaming Anthropic calls for those combinations until native support is implemented.

Structured-output parse failures now throw clear provider/model-context errors. Handle invalid model output explicitly.

## Chatbot and agent resume semantics

Chatbots support conversation/session interactions and AG-UI exposure. Agents support task runs, events, `waiting`, `resume`, and `steer`. Current confirmation flows are explicit structured-context flows: a destructive or confirmation-required tool can put a run into `waiting`, and a later `resume()` supplies confirmation context. Full live collaborative editing semantics remain application-specific.

## Local models

Reasoning models need room. Models that think before answering can spend output tokens on reasoning. With a small `maxTokens`, structured answers may arrive empty or cut off. Use a non-reasoning model for strict decisions or increase output token limits.

LM Studio can answer `500` to parallel requests while it is still loading a model. Configure retry in AI defaults for local smoke tests.

## Platform validation

Platform handlers validate input against the schema but may pass the original input shape through. Do not rely on schema defaults being materialized unless your Platform version guarantees it; default optional fields in code when necessary.
