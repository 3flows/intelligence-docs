---
title: Intelligence 0.9 learning path
sidebar_label: Overview
slug: /learning-path
---

# Intelligence 0.9 learning path

This path explains the building blocks in the order you normally adopt them in an application. It follows the current `intelligence-samples/starter` app.

The short version:

```text
AIs → Fluent inference → Chatbots → Skills + agents → Workflows
```

Each layer answers a different question.

| Step | Building block | Question it answers | Starter files |
| --- | --- | --- | --- |
| 1 | `ais:` | Which model providers and capabilities may the app use? | `starter/intelligence.yml` |
| 2 | Fluent inference | How does application code call a model safely? | `starter/support-service.ts` |
| 3 | Chatbots | How does an external human get a session-style AI surface? | `starter/intelligence.yml` |
| 4 | Skills + agents | How do I package tools/instructions and run task-oriented AI work? | `starter/intelligence.yml`, `starter/support-service.ts` |
| 5 | Workflows | How do I orchestrate deterministic multi-step work? | `starter/workflows.ts` |

## The mental model

### AIs are configuration

`ais:` defines the provider, model, credentials, capabilities, defaults, retry, and timeout. It does not decide business behavior.

### Fluent inference is the application API

Services use `trigger.context.inference()` for direct model capabilities: chat, choice, check, score, extract, embeddings, reranking, speech, image, OCR, moderation, and collections.

Use Fluent inference when application code owns the operation: drafting, triage, extraction, scoring, evaluations, batch processing, or workflow steps.

### Chatbots are interactive surfaces

A chatbot is a named human-facing AI surface with sessions, history, files, reactions, HTTP compatibility routes, optional retrieval/structured output, tools, and AG-UI exposure.

Use chatbots when the primary use case is **one external human talking to one configured AI surface**.

### Skills are reusable capability bundles

A skill is declarative: instructions, tool references, examples, and policy. A skill does not contain executable TypeScript. Executable work lives in services as `handler(...)` or model-facing `tool(...)` handlers.

### Agents are task/run harnesses

An agent uses a model, instructions, skills, tools, policy, optional workspace memory, and transports. It creates runs and events.

Use agents when the unit of work is a task that may call tools, wait for confirmation, emit progress, or delegate.

### Workflows orchestrate known processes

A workflow is code-defined Platform Flow orchestration. Use workflows when the process shape is known: run this step, branch here, call this service, wait for this event, start this agent, return this report.

## How to read the starter sample

The starter intentionally contains all five layers in a small support application:

1. `intelligence.yml` defines one AI named `DEFAULT`.
2. `SupportService.ask` uses Fluent chat directly.
3. `SupportService.triageTicket` uses Fluent `choice()` so code receives typed data.
4. `chatbots.support` exposes a session-style support chatbot.
5. `skills.starter_support` bundles support instructions and public order tools.
6. `agents.starter_agent` runs task-oriented support work using that skill.
7. `workflows.ts` defines `starter.quickAnswer`, and `SupportService.askWithWorkflow` runs it.

## Choose the right primitive

| You need | Use |
| --- | --- |
| One direct model call from code | Fluent inference |
| A typed decision your code branches on | `choice`, `check`, `score`, or `extract` |
| A customer-facing chat surface | Chatbot |
| A reusable instruction/tool bundle | Skill |
| A task with run id/events/tools/policy | Agent |
| A known multi-step process | Workflow |
| A model-call audit trail | `IntelligenceTraceDomain` via metadata/tracing |
| Business state | Your app's Platform docs/entities/domains |

Start with [AIs](./01-ais.md).
