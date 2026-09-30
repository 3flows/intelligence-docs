---
title: Tutorial overview
sidebar_label: Overview
slug: /tutorial
---

# Build an AI support desk

In this tutorial you build the support desk of Velo, a small bike shop. Customers write in. The desk drafts replies, routes and prioritizes tickets, chats with customers, looks up their orders and answers from the help center. Then you measure how good it is, improve it with evidence, put guardrails around it, and run it in production.

The tutorial has six parts. Each part answers one question and ends with something that works:

| Part | Question | Result |
|---|---|---|
| **1. Your first intelligent service** | How do I use a model at all? | A service that drafts replies, runs on any model, and is tested offline |
| **2. Turn language into data** | How does my code act on what the model understands? | Every ticket triaged into typed data |
| **3. Converse and act** | How does it hold a conversation and do things? | A chat assistant that looks up orders |
| **4. Give it knowledge** | How does it know what we know? | Grounded answers with sources |
| **5. Quality and guardrails** | How do we know it's good, and keep it good? | Quality as a number, and a person for everything uncertain |
| **6. Run it in production** | How do we operate it? | Cheap, resilient, observable |

Every chapter follows the same pattern:

- **Where we are:** the app so far
- **The problem:** what's missing or broken
- **The solution:** the smallest change that fixes it
- **Run it:** see it working with a real model
- **Test it:** prove it without one
- **Reviewer's view:** what a human needs to understand to approve the change

This tutorial builds on the [3flows Platform](https://3flows.github.io/platform-docs/). Services, handlers, `docs`, `blobs`, `mq` and `vectors` are used as they are. If you're new to language models, read [Models for application developers](../concepts/models-for-developers.md) first; it takes ten minutes.

## The journey

### Part 1: Your first intelligent service

A model call is part of a service, reached through the trigger context like every other platform primitive.

| Chapter | Problem | Concept |
|---|---|---|
| [Set up a project](./setup.md) | Where do I start? | `package.json`, `.yarnrc.yml`, `intelligence.yml` |
| [1. An intelligent service](./intelligent-service.md) | How little does it take? | `IntelligenceService`, `trigger.context.inference()`, `ais` |
| [2. Anatomy of a call](./anatomy-of-a-call.md) | The answers are generic | Instructions, input, question; immutable chains |
| [3. Prompts as configuration](./prompts-as-configuration.md) | Policy is hidden in code | `prompts`, versions, variables |
| [4. Swap the model, test without one](./swap-and-test.md) | Is the model a choice in YAML, and how do we test? | Providers, the scripted provider |

### Part 2: Turn language into data

Decisions your code can act on. From here, the ticket keeps one shape, and each chapter changes one file: `triage.ts`.

| Chapter | Problem | Concept |
|---|---|---|
| [5. Choose](./choose.md) | Every ticket lands in one inbox | `choice().oneOf()`, `.manyOf()` |
| [6. Judge](./judge.md) | Urgent tickets and angry customers wait like any other | `check()`, `score()` |
| [7. Extract](./extract.md) | Agents copy order numbers by hand | `extract().schema()` |
| [8. The model decides meaning, the code decides action](./meaning-and-action.md) | Where do business rules go? | Rules in code, fed by decisions |

### Part 3: Converse and act

| Chapter | Problem | Concept |
|---|---|---|
| [9. Remember](./remember.md) | The assistant forgets the last message | `conversations()` |
| [10. Stream](./stream.md) | Customers stare at a spinner | `stream()` |
| [11. Act](./act.md) | "Where's my order?" can't be answered | Tools, scoped to the customer |

### Part 4: Give it knowledge

| Chapter | Problem | Concept |
|---|---|---|
| [12. Documents as context](./documents-as-context.md) | The answer is in the attached file | `withBlob()` |
| [13. Embeddings](./embeddings.md) | The help center can't be searched by meaning | `embedding()`, `vectors` |
| [14. Answer from knowledge](./answer-from-knowledge.md) | The model makes up return policies | Retrieval-augmented generation |
| [15. Rerank](./rerank.md) | The best article is third | `reranker()` |

### Part 5: Quality and guardrails

Quality stops being a feeling. It becomes a number you can change.

| Chapter | Problem | Concept |
|---|---|---|
| [16. Measure before you improve](./measure.md) | How good is the triage, really? | An evaluation set, `yarn eval` |
| [17. Improve with evidence](./improve-with-evidence.md) | What do we change, and did it help? | Targeted changes, compared runs |
| [18. Judge the answers](./judge-the-answers.md) | Free-text answers can't be compared with an expected value | The model as judge |
| [19. Guard the input](./guard-the-input.md) | Some messages must not reach the model | `moderation()`, policy checks |
| [20. Guard the output](./guard-the-output.md) | Some replies must not reach the customer | Review before sending |
| [21. Humans in the loop](./humans-in-the-loop.md) | The model is unsure, or wrong | Confidence gates, corrections as evaluation cases |

### Part 6: Run it in production

| Chapter | Problem | Concept |
|---|---|---|
| [22. The right model for each job](./the-right-model-for-each-job.md) | One big model for everything is slow and expensive | Several `ais`, `.model()`, an evaluation decides |
| [23. Don't block, expect failure](./dont-block.md) | Creating a ticket takes five seconds, and fails when the provider does | `mq`, retries, failure as a state |
| [24. See what it did](./see-what-it-did.md) | Why did it say that? What did it cost? | Inference runs, metadata, traces |
| [25. Going live](./going-live.md) | Memory providers don't survive a restart | Production YAML, parity, retention |

## The samples

Every chapter has a complete project in the [intelligence-samples](https://github.com/3flows/intelligence-samples/tree/main/support-desk) repository.

- **Tests need no model and no key.** `yarn test` runs every step against a scripted model; chapter 4 explains how.
- **Running a step** talks to a real model: OpenAI by default, or a [local model](../guides/local-models.md).
- **Evaluations** (Part 5) need a real model too. The numbers in Part 5 come from runs against a local model in LM Studio.

Requirements: access to the 3flows repositories, a GitHub token with `read:packages`, and Node.js 24+ with Corepack. The [setup page](./setup.md) explains all three.

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
git clone https://github.com/3flows/intelligence-samples.git
cd intelligence-samples/support-desk
yarn install
yarn test                          # every step, offline
export OPENAI_API_KEY=<your key>
yarn step:01                       # a single step, with a real model
```

:::note A preview in the samples
The samples use `IntelligenceService` and `handler` from `steps/_shared/intelligence-service.ts`: a preview of a change proposed for `@3flows/intelligence`, which puts `inference()`, `conversations()` and `prompts()` into the trigger context. Once the library ships it, only the import changes.
:::

Ready? To follow along in your own project, [set one up](./setup.md) first. Otherwise, start with [An intelligent service](./intelligent-service.md).
