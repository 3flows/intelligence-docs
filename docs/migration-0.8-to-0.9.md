---
title: Migrating from 0.8 to 0.9
---

# Migrating from 0.8 to 0.9

This guide moves an application from `@3flows/intelligence@0.8.30` to `0.9.0`. What changed and why is in [What's new in 0.9](./whats-new-0.9.md).

There's no compatibility layer: the 0.8 building blocks (channels, conversational agents, skill classes, `Model`) don't exist in 0.9. A migration is a port, building block by building block. Every section below shows 0.8 on the left and 0.9 on the right, or 0.8 first and 0.9 after it.

:::tip Before you plan
Read [Known gaps](./guides/known-gaps.md) first. Fixes for 0.8 continue on the `0.8.x` branch.
:::

## The map

| 0.8 | 0.9 | Section |
|---|---|---|
| `@3flows/platform` 0.8 | `@3flows/platform` 0.9, pinned | [1](#1-packages) |
| `models`, `embeddings` | `ais` | [2](#2-models-and-embeddings-become-ais) |
| `IntelligenceService` with `handle(signal)` | `IntelligenceService` with handlers | [3](#3-services) |
| `model().chatCompletion(…)`, `invokeWithStructuredOutput(…)` | The fluent API | [4](#4-model-calls) |
| `personality`, prompts in skill classes | `prompts` | [5](#5-prompts) |
| `Skill` classes and their `Tool`s | Handlers marked with `tool(...)` | [6](#6-skills-and-tools) |
| `channels` with `http-chat`, and a `conversational` agent | `chatbots` | [7](#7-channels-and-conversational-agents-become-chatbots) |
| `quality` agents, `qualityprompts` | `check` and `score` | [8](#8-quality-agents-become-checks) |
| Records of models and conversations | The three domains | [9](#9-stored-data) |
| Your own provider mocks | The testing kit | [10](#10-tests) |

## 1. Packages

Intelligence 0.9 runs on Platform 0.9, and names the exact Platform version it needs. Pin both, so there's exactly one Platform in `node_modules`:

```json title="package.json"
"dependencies": {
    "@3flows/intelligence": "0.9.0",
    "@3flows/platform": "0.9.0"
}
```

The platform has a [migration guide](https://3flows.github.io/platform-docs/docs/release/migration-0.8-to-0.9) of its own for 0.8 to 0.9; do that part first.

Start the application with `Intelligence.run`, not `Platform.run`:

```ts title="main.ts"
import { Intelligence } from '@3flows/intelligence';
import './services.js';

await Intelligence.run('./intelligence.yml');
```

## 2. `models` and `embeddings` become `ais`

**0.8**

```yaml
models:
  - name: gpt
    provider: openai
    model: gpt-4.1-mini

embeddings:
  - name: embedding
    provider: openai
    model: text-embedding-3-small
```

**0.9**

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      timeoutMs: 30000
      retry: { attempts: 3, backoffMs: 1000 }

  - name: embeddings
    provider: openai
    model: text-embedding-3-small
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      timeoutMs: 10000
```

| 0.8 | 0.9 |
|---|---|
| `provider: openai` | `provider: openai` |
| `provider: azureai` (models), `azure` (embeddings) | `provider: azureai` |
| `provider: generic-openai` | `provider: openai-compatible`, with `connection.baseUrl` |
| Keys from the environment, like `OPENAI_API_KEY` | Named in YAML: `connection.apiKey: ${{ OPENAI_API_KEY }}` |
| One model is chosen by name | An AI is chosen by **capability**; name one with `.model(name)` only where it matters |
| `parameters.reasoningEffort` | `defaults.reasoningEffort`; `parameters.reasoningEffort` is still read |

An AI named `DEFAULT` is used when a chain names none. Embedding models are found by their capability: `embedding()` needs no name. See [`ais`](./configuration/ais.md).

## 3. Services

**0.8**

```ts
export class SupportService extends IntelligenceService {
    async handle(signal: Signal): Promise<void> { /* … */ }

    async draft(ticket: Ticket) {
        const model = this.model('gpt');
        // …
    }
}
```

**0.9**

```ts
import { IntelligenceService, handler } from '@3flows/intelligence';
import { Register, t } from '@3flows/platform';

@Register()
export class SupportService extends IntelligenceService {
    handlers = () => [
        handler('draftReply', Ticket, Reply, async (ticket, trigger) => {
            const { inference } = trigger.context;
            // …
        })
    ];
}
```

| 0.8 | 0.9 |
|---|---|
| `abstract handle(signal: Signal)` | Gone. Work is done in handlers and routes |
| `Signal` | Gone. For cancellation, pass `trigger.signal` to a chain with `.signal(...)` |
| `this.model(name)`, `this.embedding(name)` | `trigger.context.inference()` |
| `this.skill(name)`, `this.skills()` | Another service: `trigger.context.service(name)`. Skills are configuration now |
| `handler` from `@3flows/platform` | `handler` from `@3flows/intelligence`: the same handler, with a trigger context that has `inference()`, `prompts()`, `agent()`, `workflow()` |

## 4. Model calls

**0.8**

```ts
const response = await this.model('gpt').chatCompletion([
    { role: 'system', content: 'You draft replies for Velo.' },
    { role: 'user', content: JSON.stringify(ticket) }
]);

const triage = await this.model('gpt').invokeWithStructuredOutput<Triage>(
    `Classify this ticket: ${ticket.body}`,
    TriageSchema
);
```

**0.9**

```ts
const ai = trigger.context.inference();

const reply = await ai.chat()
    .instructions('You draft replies for Velo.')
    .with(ticket)
    .question('Draft a reply to this ticket.')
    .answer();

const department = await ai.choice('department')
    .oneOf(['billing', 'technical', 'sales'])
    .instructions('Which team should handle this ticket?')
    .state(ticket.body)
    .decide();

const facts = await ai.extract('facts').schema(Facts).from(ticket.body).extract();
```

| 0.8 | 0.9 |
|---|---|
| `chatCompletion(messages)` | `chat()` with `.instructions(...)`, `.with(...)`, `.question(...)`, then `.answer()` |
| A system message | `.instructions(...)` or `.prompt(name)` |
| Data pasted into the user message | `.with(data)`: kept apart from instructions |
| Earlier messages in the `messages` array | `.messages(history)` |
| `toolDescriptions`, tool requests and responses passed by hand | `.tools(...)`, `.service(...)`, `.toolsFrom(...)`: the tool loop runs inside `.answer()` |
| `invokeWithStructuredOutput(prompt, schema)` | `extract(name).schema(schema).from(data).extract()` |
| A structured output with one enum field | `choice(name).oneOf(options)` |
| A structured output with one boolean or number | `check(name)`, `score(name).between(min, max)` |
| `ChatCompletionOptions` | `.options({ temperature, maxTokens, … })`, or `defaults` on the AI |
| `traceId` as the last argument | `.trace(traceId)`, `.metadata({ subjectType, subjectId, purpose })` |
| The embedding service | `inference().embedding().with(text).embed()` |

Give every call a `.timeout(...)` or a `timeoutMs` in the AI's `defaults`. The tutorial's Parts 1 and 2 introduce these calls one by one: [Tutorial](./tutorial/index.md).

## 5. Prompts

**0.8:** the `personality` of an agent, and the prompts returned by a skill's `getSkillPrompt` and `getQualityPrompt`.

**0.9:** a catalog in YAML.

```yaml
prompts:
  - name: support.reply
    version: v1
    template: |
      You draft replies for the support team of {{ shop }}, a bike shop.
      Never promise refunds, discounts or delivery dates.
```

```ts
ai.chat().prompt('support.reply', { shop: 'Velo' })
```

Move every piece of policy text out of code and out of `personality` into a prompt with a `version`, and bump the version when it changes. See [`prompts`](./configuration/prompts.md).

## 6. Skills and tools

This is the largest change. A 0.8 skill was a class: it owned tools, structured outputs and prompts, and used a model itself. A 0.9 skill is a few lines of YAML. The code moves into services.

**0.8**

```yaml
skills:
  - name: orders
    scope: support
    type: local
    class: OrdersSkill
    model: gpt
```

```ts
export class OrdersSkill extends Skill {
    tools = () => [ /* Tool objects: lookupOrder, … */ ];
}
```

**0.9**

```ts
import { IntelligenceService, tool } from '@3flows/intelligence';

@Register()
export class OrdersService extends IntelligenceService {
    handlers = () => [
        tool('lookupOrder', OrderQuery, Order.nullable(), async ({ number }, trigger) => {
            await trigger.ok(await findOrder(trigger.context, number));
        }, {
            name: 'lookup_order',
            description: 'Look up an order by number: status, items and shipping date.',
            readOnly: true,
            tags: ['orders']
        })
    ];
}
```

| 0.8 | 0.9 |
|---|---|
| A `Tool` of a skill | A service handler, marked with `tool(...)` |
| `skill.do(toolCall)` | The tool loop of `chat()`, a chatbot or an agent calls the handler |
| `skill.extract(file, …)`, `analyse`, `classify` | `extract`, `chat` and `choice` with `.withFile(...)` or `.withBlob(...)` |
| `StructuredOutput`s of a skill | A schema, passed to `extract(name).schema(...)` |
| `type: remote`, `RemoteSkill` | A platform service in another process, called through `service(name)` |
| `scope`, `class`, `model`, `embedding` on a skill | Gone |
| `skills:` in YAML | Only if agents need them: `{ name, instructions, tools }`. See [Skills](./concepts/skills.md) |

Who may use a tool is no longer decided by which skills an agent has. It's decided per call (`.tools(...)`, `.service(...)`), or by service and tag in the YAML of a chatbot or agent.

## 7. Channels and conversational agents become chatbots

**0.8**

```yaml
channels:
  - name: chat
    type: http-chat
    parameters:
      useHttp: public
      sseEnabled: true
      agents:
        - path: /support
          agent: support

agents:
  - name: support
    type: conversational
    personality: You are the assistant of Velo, a bike shop.
    model: gpt
    skills: [orders]
    inputValidation: true
    parameters:
      greeting: Hi, how can I help?
      memory: middle
```

**0.9**

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    greeting: Hi, how can I help?
    prompts:
      - name: support.assistant
        version: v1
    history:
      maxMessages: 20
    inputValidation: true
    tools:
      - service: OrdersService
        tags: [orders]
    http:
      useHttp: public
      path: /support

entities:
  backend: docs
  domains:
    - IntelligenceTrace
    - IntelligenceChatbot
```

| 0.8 | 0.9 |
|---|---|
| `channels[].parameters.agents[].path` | `chatbots[].http.path` |
| `channels[].parameters.useHttp` | `chatbots[].http.useHttp` |
| `sseEnabled`, `streamableEnabled`, `wsEnabled` | Streaming over server-sent events is always there: `POST /conversation/:id/stream`. There's no WebSocket transport |
| `agents[].personality` | `chatbots[].prompts`, or `instructions` |
| `agents[].model` | `chatbots[].model`: the name of an AI |
| `agents[].skills` | `chatbots[].tools`: service and tags |
| `parameters.greeting`, `initialRecommendations`, `disclaimer` | `greeting`, `initialRecommendations`, `disclaimer` |
| `parameters.memory: short` / `middle` / `long` / `forever` | `history.maxMessages` or `history.maxTokens` |
| `inputValidation`, `outputValidation`, `allowedMimeTypes`, `secureFileUpload`, `useAV`, `customizable`, `observabilityTag` | The same names, on the chatbot |
| `channels[].parameters.auth` | Authentication of the platform HTTP server the chatbot is on |
| `email` and `sms` channels | No chatbot transport. Receive the message in a platform route or connector, and call a service |

The HTTP routes keep their names (`POST /conversation`, `POST /conversation/:id`, files, reactions), so a client of the 0.8 chat API has little to change. File listings keep `originalFileName`, `storageContainer` and `storagePath` from 0.8.30; `fileName` is the sanitised name the file is stored under. Test it against your client: this guide hasn't verified every field of every response.

**Not every conversational agent should become a chatbot.** A chatbot fits one person talking to one assistant. If your 0.8 agent worked on something your application owns (a ticket, a case), a service with `chat().messages(history)` fits better: the service adds the record to every turn, scopes the tools to the user, and checks the answer. The tutorial builds exactly that in [Remember](./tutorial/remember.md) and [Act](./tutorial/act.md), and a chatbot in [A chatbot](./tutorial/a-chatbot.md).

**The word "agent" has moved.** In 0.9, an agent is a model that works on a task in several steps. Use one where 0.8 had an agent that called several tools in a row to get something done. See [Agents](./concepts/agents.md).

## 8. Quality agents become checks

**0.8:** agents of `type: quality`, and `qualityprompts`, reviewed an answer.

**0.9:** a review is a call, and its result is a typed value your code acts on.

```ts
const grounded = await ai.check('grounded')
    .instructions('Is every statement of fact in the reply supported by the sources?')
    .state({ reply, sources })
    .decide();

if (!grounded.value) { /* hand over to a person */ }
```

The tutorial's Part 5 covers judges, guardrails before and after the model, and measuring them: [Judge the answers](./tutorial/judge-the-answers.md), [Guard the output](./tutorial/guard-the-output.md).

## 9. Stored data

0.9 doesn't read the records 0.8 wrote. Decide per kind of data:

| 0.8 data | In 0.9 |
|---|---|
| Your own business records | Unchanged: they're yours |
| Conversations people may want to continue | There's no import. Either let old conversations end with 0.8, or copy their messages into your own store and send them with `chat().messages(...)` |
| Conversations kept for the record | Export them from the 0.8 store before you switch it off |
| Records of model calls | New ones are written to the `IntelligenceTrace` domain. Old ones stay where they are |

Register the domains you use:

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceTrace      # every model call
    - IntelligenceChatbot    # with chatbots
    - IntelligenceAgent      # with agents
```

And decide on retention for each: trace records keep the inputs and outputs of calls, sessions keep what people typed. See [Going live](./tutorial/going-live.md).

## 10. Tests

**0.8:** tests mocked the model's HTTP calls or replaced the model service.

**0.9:** run the real YAML with every AI replaced by a scripted provider.

```ts
import { ScriptedAI, runOffline } from '@3flows/intelligence/testing';

before(() => runOffline('./intelligence.yml'));
beforeEach(() => ScriptedAI.clear());

test('routes to the department the model chose', async () => {
    ScriptedAI.respond(() => ({ structured: { value: 'billing', confidence: 0.9, reason: 'Charged twice.' } }));
    // call your handler, then assert on the result and on ScriptedAI.requests()
});
```

See [Testing](./guides/testing.md).

## A migration order that works

1. Platform 0.8 to 0.9, with the application still on Intelligence 0.8 where possible.
2. `ais`, and one service ported to the fluent API, with offline tests.
3. Prompts into the catalog.
4. Skill classes into services with `tool(...)` handlers.
5. Channels and conversational agents into chatbots, or into services that own the conversation.
6. The domains, and a retention rule for each.
7. `intelligence.strict: true`, and a look at what the startup validation still reports.

## Checklist

- [ ] One `@3flows/platform` in `node_modules`, the version Intelligence asks for.
- [ ] The application starts with `Intelligence.run`.
- [ ] No `models`, `embeddings`, `channels` in YAML; no `Model`, `Skill`, `Signal`, `Channel` in code.
- [ ] Every AI has `defaults.timeoutMs`; every prompt has a `version`.
- [ ] Every call that code branches on is a `choice`, `check`, `score` or `extract`.
- [ ] Tools are handlers; tools that read user data are scoped to the user.
- [ ] `IntelligenceTrace` is registered, and calls are tagged with `.metadata({ subjectType, subjectId })`.
- [ ] Tests run offline, with the real YAML.
- [ ] A retention rule for traces, sessions and runs.
