---
title: Tutorial overview
sidebar_label: Overview
slug: /tutorial
---

# Build an AI support desk

In this tutorial you build the support desk of Velo, a small bike shop. Customers write in; the desk drafts replies, routes and prioritizes tickets, chats with customers, looks up their orders and answers from the help center. Then you choose the right model for each job, add guardrails, and look inside.

You start with a single question to a model and add **one concept per chapter**. Every chapter follows the same pattern:

- **Where we are:** the app so far
- **The problem:** what's missing or broken
- **The solution:** the smallest change that fixes it
- **Run it:** see it working
- **Reviewer's view:** what a human needs to understand to approve the change

This tutorial builds on the [3flows Platform](https://3flows.github.io/platform-docs/): services, handlers, `docs`, `blobs`, `mq` and `vectors` are used as they are, and explained there. You don't need to have done the platform tutorial, but it helps. If you're new to language models, read [Models for application developers](../concepts/models-for-developers.md) first. It takes ten minutes.

## The journey

Every chapter continues from the one before it. The app only grows.

### Part 1: Ask the model

A model call as an ordinary piece of a service.

| Chapter | Problem | Concept |
|---|---|---|
| [Set up a project](./setup.md) | Where do I start? | `package.json`, `.yarnrc.yml`, `intelligence.yml` |
| [0. Hello, model](./hello-model.md) | How little does it take? | `ais`, `chat().ask()` |
| [1. Give it a job](./give-it-a-job.md) | The answers are generic | `instructions`, `with`, immutable chains |
| [2. Prompts in YAML](./prompts-in-yaml.md) | Policy is hidden in code | `prompts`, versions, variables |
| [3. Test without a model](./test-without-a-model.md) | Tests are slow, flaky and cost money | A scripted provider |

### Part 2: Turn language into data

Decisions your code can act on.

| Chapter | Problem | Concept |
|---|---|---|
| [4. Route tickets](./route-tickets.md) | Every ticket lands in one inbox | `choice().oneOf()` |
| [5. Tag topics](./tag-topics.md) | Nobody knows what customers write about | `choice().manyOf()` |
| [6. Flag urgent tickets](./flag-urgent-tickets.md) | Urgent tickets wait like any other | `check()` |
| [7. Measure frustration](./measure-frustration.md) | Angry customers wait too | `score()` |
| [8. Extract a triage record](./extract-a-triage-record.md) | Agents copy order numbers by hand | `extract().schema()` |
| [9. Triage in the background](./triage-in-the-background.md) | Creating a ticket takes five seconds | `mq` |

### Part 3: Talk and act

From drafting replies to a conversation that can look things up.

| Chapter | Problem | Concept |
|---|---|---|
| [10. Remember the conversation](./remember-the-conversation.md) | The assistant forgets the last message | `conversations()` |
| [11. Stream the answer](./stream-the-answer.md) | Customers stare at a spinner | `stream()` |
| [12. Let it look things up](./let-it-look-things-up.md) | "Where's my order?" can't be answered | Tools: services and inline |
| [13. Read attachments](./read-attachments.md) | The answer is in the attached file | `withBlob()` |

### Part 4: Answer from knowledge

The help center, in every answer.

| Chapter | Problem | Concept |
|---|---|---|
| [14. Embeddings](./embeddings.md) | The help center can't be searched by meaning | `embedding()`, `vectors` |
| [15. Answer from the help center](./answer-from-the-help-center.md) | The model makes up return policies | Retrieval-augmented generation |
| [16. Rerank](./rerank.md) | The best article is third | `reranker()` |

### Part 5: Operate it

Before it goes live, the team wants cost, safety and insight.

| Chapter | Problem | Concept |
|---|---|---|
| [17. The right model for each job](./the-right-model-for-each-job.md) | One big model for everything is slow and expensive | Several `ais`, `.model()`, defaults |
| [18. Guardrails](./guardrails.md) | Not every message should reach the model, or be answered by it | `moderation()`, `check()`, confidence |
| [19. See what the model did](./see-what-the-model-did.md) | Why did it say that? What did it cost? | Inference runs, metadata, tracers |

Watch for one recurring theme: the parts of the code that talk to the model stay short and read like a description of the feature. What grows is YAML (models, prompts, stores) and ordinary service code that decides what to do with the answer.

## The samples

Every chapter has a complete, tested project in the [intelligence-samples](https://github.com/3flows/intelligence-samples/tree/main/support-desk) repository.

**Tests need no model and no key.** They run every step against a scripted model; chapter 3 explains how. **Running a step** talks to a real model, OpenAI by default. Set `OPENAI_API_KEY`, or switch the YAML to a [local model](../guides/local-models.md).

Requirements: access to the 3flows repositories, a GitHub token with `read:packages`, and Node.js 24+ with Corepack. The [setup page](./setup.md) explains all three.

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<a GitHub token with read:packages>
git clone https://github.com/3flows/intelligence-samples.git
cd intelligence-samples/support-desk
yarn install
yarn test                          # every step, offline
export OPENAI_API_KEY=<your key>
yarn step:00                       # a single step, with a real model
```

Ready? To follow along in your own project, [set one up](./setup.md) first. Otherwise, start with [Hello, model](./hello-model.md).
