# Migration guide: 0.8 to 0.9

This guide compares **published `@3flows/intelligence@0.8.30`** with **`@3flows/intelligence@0.9.0-next.4`**.

0.9 is not a small API rename. It replaces the 0.8 framework stack (`models`, `embeddings`, `channels`, old `agents`, executable `skills`, `signal`) with a Platform-native stack:

- `ais` and Fluent `inference()` for model capabilities,
- `chatbots` for interactive sessions,
- declarative `skills`,
- run-based `agents`,
- code-defined `workflows`,
- separate trace/chatbot/agent domains.

## High-level mapping

| 0.8.30 concept | 0.9 replacement | Migration action |
| --- | --- | --- |
| `models:` | `ais:` | Merge model provider/model/connection/defaults into AI definitions. |
| `embeddings:` | `ais:` with `embedding` capability | Define an AI for embeddings instead of a separate embedding service. |
| `Model.chatCompletion(...)`, `structuredOutput(...)` | `trigger.context.inference().chat()`, `.extract()`, `.choice()`, `.check()`, `.score()` | Replace low-level model service calls with Fluent inference chains. |
| `Embedding` service | `trigger.context.inference().embedding()` | Replace direct embedding service use with Fluent embedding chains. |
| `channels:` / `http-chat` / `email` | `chatbots:` plus Platform routes/services | Rebuild user-facing chat surfaces as chatbots or explicit Platform routes. |
| `channels.http-chat.parameters.agents[].agent` | `chatbots[].http`, `agents[].http`, or explicit route handlers | Choose whether the surface is a session chatbot, task agent, or normal service route. |
| 0.8 `Agent` with `type: conversational` | `chatbots:` for conversations, `agents:` for tasks | Split interactive chat from task/run harnesses. |
| `agents[].personality` | `chatbots[].instructions` or `agents[].instructions` | Move persona text into instructions/prompts. |
| `agents[].parameters.memory` | `chatbots[].history` or `agents[].context`/`workspace` | Configure bounded history/workspace explicitly. |
| `Skill` subclass with `tools()`, `do()`, `extract()`, `analyse()`, `classify()` | Platform `tool(...)` handlers + Fluent inference + declarative `skills:` | Move executable code to services; keep skill config declarative. |
| `skills:` with `scope`, `type: local/remote`, `class`, `model`, `embedding` | `skills:` with `instructions`, `tools`, `examples`, `policy` | Rewrite skill config; remote-skill runtime is not a 0.9 primitive. |
| `skillprompts` / `qualityprompts` | `prompts:`, instructions, explicit evaluator calls | Move prompt text into named prompts and use `check`/`score` for quality gates. |
| `Signal` and `handle(signal)` | Platform service lifecycle + `AbortSignal`, `timeout(...)`, policy | Remove service `handle(signal)` code unless your app still needs its own background process. |
| 0.8 file/input validation errors | Chatbot upload/security settings, Platform validation, custom handlers | Move validation to chatbot config or service logic. |
| 0.8 inference/conversation entities | `IntelligenceTraceDomain`, `IntelligenceChatbotDomain`, `IntelligenceAgentDomain` | Migrate storage/retention by responsibility, not record name. |

## Package/import changes

### 0.8.30 exports

Published 0.8 exported these main areas:

```ts
export * from './agents';
export * from './channels';
export * from './embeddings';
export * from './models';
export * from './signal';
export * from './skills';
```

`Intelligence` was mostly runtime bootstrap and lookup:

```ts
Intelligence.run(path);
Intelligence.shutdown();
Intelligence.lookup(id);
Intelligence.remember(id, service);
```

### 0.9 exports

0.9 exports the new runtime surfaces:

```ts
import { Intelligence, IntelligenceService, handler, tool, workflow } from '@3flows/intelligence';
import { runOffline, ScriptedAI } from '@3flows/intelligence/testing';
import { Service, Register, t } from '@3flows/intelligence/platform';
```

`Intelligence` now also exposes runtime-aware helpers:

```ts
Intelligence.create();
Intelligence.use(runtime);
Intelligence.runtime();
Intelligence.withRuntime(runtime, fn);
Intelligence.inference();
Intelligence.chatbots();
Intelligence.inspect();
Intelligence.version();
```

Inside services, prefer the trigger context:

```ts
trigger.context.inference();
trigger.context.prompts();
trigger.context.skill('name');
trigger.context.agent('name');
trigger.context.workflow('name');
```

## Service migration

### 0.8

0.8 `IntelligenceService` was abstract and required `handle(signal)`. It exposed old model/embedding/skill helpers:

```ts
export class MyService extends IntelligenceService {
  async handle(signal: Signal): Promise<void> {
    // old background/lifecycle style
  }

  async ask(text: string) {
    const model = this.model('gpt');
    return model.chatCompletion([{ role: 'user', content: text }]);
  }
}
```

### 0.9

0.9 `IntelligenceService` is a Platform service with an enriched service context. Use typed handlers and Fluent inference:

```ts
import { IntelligenceService, handler } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';

@Register()
export class MyService extends IntelligenceService {
  handlers = () => [
    handler('ask', t.object({ text: t.string() }), t.object({ answer: t.string() }), async ({ text }, trigger) => {
      const response = await trigger.context
        .inference()
        .chat()
        .metadata({ purpose: 'ask' })
        .timeout(10_000)
        .ask(text);

      await trigger.ok({ answer: response.text ?? '' });
    })
  ];
}
```

## Models and embeddings to `ais`

### 0.8

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

### 0.9

```yaml
ais:
  - name: gpt
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      timeoutMs: 10000

  - name: embedding
    provider: openai
    model: text-embedding-3-small
    capabilities: [embedding]
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

Then call:

```ts
await trigger.context.inference().chat().model('gpt').ask('Hello');
await trigger.context.inference().embedding().model('embedding').input('text').embed();
```

## Channels and conversational agents to chatbots/agents

### 0.8

A common 0.8 HTTP chat setup routed a channel path to a conversational agent:

```yaml
channels:
  - name: public-chat
    type: http-chat
    parameters:
      useHttp: api
      sseEnabled: true
      streamableEnabled: true
      agents:
        - path: /support
          agent: support_agent

agents:
  - name: support_agent
    type: conversational
    personality: You help support customers.
    model: gpt
    skills: [orders]
    parameters:
      memory: middle
```

### 0.9: user session/chat surface

Use `chatbots:` when users are having a session-style conversation:

```yaml
chatbots:
  - name: support
    type: conversation
    model: gpt
    instructions:
      - You help support customers.
    history:
      maxMessages: 20
    http:
      path: /support
      useHttp: api
    tools:
      - service: OrdersService
```

The compatibility HTTP routes still use the word `/conversation`, but durable records are chatbot sessions/messages/files/reactions.

### 0.9: task/run surface

Use `agents:` when the unit of work is a task with a run id, events, policy, workspace, and optional delegation:

```yaml
agents:
  - name: support_agent
    model: gpt
    instructions:
      - Resolve support tasks step by step.
    skills: [orders]
    tools:
      - service: OrdersService
    http:
      path: /agents/support
      useHttp: api
```

Run it from a handler:

```ts
const run = await trigger.context
  .agent('support_agent')
  .task('Resolve ticket T-42')
  .input({ ticketId: 'T-42' })
  .run();
```

## Skills changed from executable services to declarative bundles

### 0.8

0.8 skills were services/classes. They could own tools and structured outputs:

```yaml
skills:
  - name: orders
    scope: support
    type: local
    class: OrdersSkill
    model: gpt
    embedding: embedding
```

```ts
class OrdersSkill extends Skill {
  tools = () => [/* Tool objects */];
  getSkillPrompt = (...) => '...';
  getQualityPrompt = (...) => '...';
}
```

### 0.9

A skill is configuration only:

```yaml
skills:
  - name: orders
    description: Order lookup and order-resolution guidance.
    instructions:
      - Look up the order before proposing action.
    tools:
      - service: OrdersService
        tags: [orders]
    policy:
      allowDestructive: false
```

Executable code moves into Platform service handlers marked with `tool(...)`:

```ts
import { IntelligenceService, tool } from '@3flows/intelligence';

export class OrdersService extends IntelligenceService {
  handlers = () => [
    tool('lookupOrder', Input, Output, async (params, trigger) => {
      await trigger.ok(await lookupOrder(params.number));
    }, { description: 'Look up order status.', readOnly: true, tags: ['orders'] })
  ];
}
```

Attach the skill to an agent or reference the service tools directly from a chatbot/agent.

## Old conversations / preview docs

Some pre-0.9 documentation and samples used `conversations().conversation(id)` and `conversations:` storage. That was not the main published 0.8.30 package shape, but if your app used those preview APIs, migrate them to `chatbots:` or direct Fluent `chat()`:

| Preview conversation concept | 0.9 replacement |
| --- | --- |
| `conversations:` YAML | `chatbots:` YAML |
| `context.conversations().conversation(id)` | chatbot session API/HTTP route, or `inference().chat()` for stateless calls |
| `AIConversation*` records | `ChatbotSession`, `ChatbotMessage`, `ChatbotFile`, `ChatbotReaction`, plus trace records |
| `conversation.clear()` | delete/expire the chatbot session and files according to retention policy |

## Workflows replace ad-hoc orchestration

0.8 orchestration often lived implicitly in agents, skills, or channel dispatch. In 0.9, deterministic multi-step processes should be workflows:

```ts
import { workflow } from '@3flows/intelligence';

export const refundWorkflow = workflow('support.refund')
  .input<{ ticketId: string; text: string }>()
  .step('classify', (s) =>
    s.inference().check('refund-request')
      .state(({ input }) => input.text)
      .define()
  )
  .when('needsRefund', ({ steps }) => steps.classify.accepted)
  .step('agent', (s) =>
    s.agent('support_agent')
      .task(({ input }) => `Prepare refund resolution for ${input.ticketId}`)
      .input(({ input }) => input)
      .define()
  )
  .end()
  .returns(({ steps }) => steps);
```

Register and run workflows through an Intelligence service context:

```ts
this.workflows().register(refundWorkflow);
const output = await trigger.context.workflow('support.refund').input(input).run();
```

## Streaming

0.9 Fluent chat streaming returns `InferenceStream<AIStreamEvent, AIChatResponse>`:

```ts
const stream = await trigger.context.inference().chat().question('Hello').stream();
for await (const event of stream) console.log(event);
const text = await stream.text();
const final = await stream.completed;
```

Use `stream.toReadable({ format: 'sse' })` for HTTP SSE. Chatbots and agents also expose HTTP/AG-UI streaming surfaces when configured.

## Testing

Use the exported testing kit instead of app-local provider shims:

```ts
import { runOffline, ScriptedAI, expectPrompt, collectStream } from '@3flows/intelligence/testing';
```

Patch `globalThis.fetch` only for provider wire-format tests.

## Configuration validation and policy

0.9 validates Intelligence configuration at startup. Start with warnings, then enforce production policy:

```yaml
intelligence:
  strict: true
  inference:
    require:
      metadata: true
      timeout: true
    onViolation: error
```

Common warnings include missing prompt versions, missing AI defaults/timeouts, invalid chatbot/agent references, unbounded chatbot history, literal API keys, missing domains, and invalid response schemas.

## Storage and retention

Do not migrate old records by table name only. Migrate by responsibility:

| Data | 0.9 owner |
| --- | --- |
| Tickets/orders/cases/decisions | Your app's Platform docs/entities/domains |
| User chat sessions and messages | `IntelligenceChatbotDomain` |
| Agent runs, events, delegations, workspace index | `IntelligenceAgentDomain` |
| Technical model/tool evidence | `IntelligenceTraceDomain` |
| Large files/artifacts | Platform blobs, referenced from chatbot/agent/app records |

## Breaking changes summary

| Breaking change from 0.8.30 | Migration |
| --- | --- |
| `models:` removed | Use `ais:` and `inference().chat()` / `.extract()` / decisions. |
| `embeddings:` removed | Use `ais:` with embedding capability and `inference().embedding()`. |
| `channels:` removed | Use `chatbots`, `agents`, or Platform routes. |
| `http-chat` channel removed | Configure `chatbots[].http`, `agents[].http`, AG-UI, or explicit routes. |
| 0.8 `Agent`/`ConversationalAgent` removed | Use `chatbots` for sessions and 0.9 `agents` for task runs. |
| `personality` removed | Use `instructions` or named `prompts`. |
| `Skill` subclass execution model removed | Move code to `tool(...)` handlers; make `skills:` declarative. |
| `scope`, `type: local/remote`, `class` skill config removed | Rewrite skills as instructions/tools/policy. |
| `Skill.extract/analyse/classify` removed | Use Fluent `extract`, `chat`, `choice`/`check`/`score`, `embedding`, `reranker`. |
| `Signal` public service pattern removed | Use Platform handlers, runtime context, `AbortSignal`, `timeout`, and workflows. |
| Old model raw types/tool-call helpers no longer primary | Use AI/inference response types and service tools. |
| Old conversation/ontology preview APIs removed | Use `chatbots` and Intelligence chatbot/trace domains. |
| Streaming contract changed | Treat streams as `InferenceStream`; use `.completed`, `.text()`, `.toReadable()`. |
| No direct compatibility shim for old framework objects | Port concepts intentionally; do not try to revive Channel → Agent → Skill dispatch. |
