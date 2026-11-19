# What's new in Intelligence 0.9

Intelligence 0.9 is a large architectural update from the published 0.8 line. Compared to `@3flows/intelligence@0.8.30`, the project is no longer organized around separate `models`, `embeddings`, `channels`, old `agents`, executable `skills`, and `signal`. It is a Platform-native AI foundation with three layers:

1. **Fluent inference** over configured `ais` for direct model calls and model capabilities.
2. **Chatbots and agents** for interactive and task-oriented AI surfaces.
3. **Workflows and domains** for durable business processes, runtime records, and traceability.

## What changed from published 0.8.30

The old and new package shapes are intentionally different:

| Area | 0.8.30 | 0.9 |
| --- | --- | --- |
| Model configuration | `models:` and `embeddings:` | unified `ais:` with capabilities and defaults |
| Model API | `Model.chatCompletion(...)`, `structuredOutput(...)`, `Embedding` services | `trigger.context.inference()` Fluent chains |
| User-facing chat | `channels:` such as `http-chat` routing to old agents | `chatbots:` with HTTP conversation compatibility and AG-UI |
| Old agents | `agents[]` with `type: conversational`, `personality`, channel dispatch | run-based `agents:` with tasks, events, tools, policy, workspace, transports |
| Skills | `Skill` subclasses with `tools()`, `do()`, `extract()`, `analyse()`, `classify()` | declarative `skills:` instructions/tools/policy; executable code is `tool(...)` handlers |
| Runtime service API | abstract `IntelligenceService.handle(signal)`, `model()`, `embedding()`, `skill()` | handler-based services with `inference()`, `prompts()`, `skill()`, `agent()`, `workflow()` in context |
| Orchestration | implicit in channels/agents/skills | explicit `workflow(...)` over Platform Flow |
| Storage model | old model/conversation/tool entities and app-specific records | separate `IntelligenceTraceDomain`, `IntelligenceChatbotDomain`, `IntelligenceAgentDomain` |
| Testing | app-local scripted shims | `@3flows/intelligence/testing` |

See the [0.8 to 0.9 migration guide](./migration-0.8-to-0.9.md) for concrete before/after examples.

## Concept inventory

| 0.9 concept | Status | Use it for |
| --- | --- | --- |
| `IntelligenceService` | Current | Platform services whose handlers can call `trigger.context.inference()`, `prompts()`, `skill()`, `agent()`, and `workflow()` |
| Fluent inference | Current | `chat`, `stream`, `choice`, `check`, `score`, `extract`, `embedding`, `reranker`, `transcriber`, `speech`, `image`, `ocr`, `moderation`, and `collection` |
| Chatbots | Current | Session-style interactive assistants with HTTP `/conversation` compatibility, files, reactions, tools, retrieval, schemas, AG-UI, and history windows |
| Skills | Current | Reusable declarative capability bundles: instructions plus tools, used by agents and other harnesses |
| Agents | Current | Model-powered task harnesses with runs, events, policy, tools, skills, workspaces, peer delegation, AG-UI, A2A-shaped cards, and MCP exposure |
| Workflows | Current | Typed Platform Flow orchestration over inference, services, agents, pipeline calls, waits, branches, retry, timeout, reports, and outputs |
| UI tools | Current | Typed model-requested UI specs such as forms, confirmations, pickers, tables, charts, progress, and detail panels |
| Collection orchestration | Current | Fan-out/batch/filter/map/reduce inference work with concurrency, retry, cancellation, metadata, and settled results |
| Inference policy | Current | Requiring metadata, timeouts, or abort signals for production model calls |
| `IntelligenceTraceDomain` | Current | Durable best-effort technical model/tool trace records |
| `IntelligenceChatbotDomain` | Current | Chatbot profiles, sessions, messages, files, and reactions |
| `IntelligenceAgentDomain` | Current | Agent profiles, runs, steps, events, delegations, and workspace items |
| Old `channels:` configuration | Removed | Model routing is now explicit through services, chatbots, agents, workflows, and tools. |
| Old `http-chat` channel | Removed/replaced | Use `chatbots[].http`, `agents[].http`, AG-UI, or explicit Platform routes. |
| Old/preview `conversations:` configuration | Removed/replaced | Use `chatbots:` plus `ChatbotSession` records. HTTP compatibility still uses the word `/conversation`. |
| Old identities | Removed | Use Platform identity/auth/policy primitives. |
| Old ontology entities | Removed/replaced | Use Platform docs/blobs/vectors/domains and Intelligence trace/chatbot/agent domains. |
| Old coworkers/actor runtime | Removed/replaced | Use agents and peer delegation. |
| Old `Channel → Agent → Skill` dispatch | Removed | Agents and skills are first-class configured primitives with different semantics. |
| `models:` / `embeddings:` | Removed/replaced | Use unified `ais:` and Fluent `inference()` chains. |
| 0.8 `Signal` service pattern | Removed/replaced | Use Platform handlers, runtime context, `AbortSignal`, timeouts, and workflows. |
| `skillprompts` / `qualityprompts` | Removed | Use `prompts:`, chatbot/agent `instructions`, `skills:`, and explicit evaluator/check/score calls. |

## Fluent inference expanded

The low-level API now covers the common model capabilities directly:

```ts
const answer = await trigger.context
  .inference()
  .chat()
  .model('gpt')
  .instructions('Be concise.')
  .metadata({ purpose: 'support', subjectType: 'ticket', subjectId: ticket.id })
  .timeout(10_000)
  .ask(ticket.text);
```

Streaming returns an `InferenceStream`. It is an async iterable and also exposes `completed`, `onSettled(...)`, `text()`, and `toReadable({ format: 'text' | 'sse' })`.

## Chatbots replaced internal conversations

Configure interactive assistants under top-level `chatbots:`:

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - Help customers with short, factual answers.
    history:
      maxMessages: 20
    http:
      path: /support
    agui:
      useHttp: api
      path: /support/agui
    tools:
      - service: SupportService
```

The external compatibility API can still use routes containing `/conversation`, but the durable records are now chatbot records (`ChatbotSession`, `ChatbotMessage`, `ChatbotFile`, `ChatbotReaction`).

## Tools are Platform handlers with model metadata

Use `tool(...)` when a handler should be discoverable by models:

```ts
import { IntelligenceService, tool } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';

@Register()
export class SupportService extends IntelligenceService {
  handlers = () => [
    tool(
      'lookupOrder',
      t.object({ number: t.string() }),
      t.object({ status: t.string() }),
      async ({ number }, trigger) => trigger.ok({ status: `Order ${number} shipped` }),
      { description: 'Look up the status of an order.', readOnly: true, tags: ['public'] }
    )
  ];
}
```

Fluent chat, chatbots, agents, and MCP can discover that metadata from the service.

## Skills and agents are now first-class

A skill is a reusable capability bundle. An agent is a model-powered harness that can apply skills, call service tools, keep workspace memory, emit run events, delegate to peers, and expose transports.

```yaml
skills:
  - name: order_resolution
    instructions:
      - Check the order before recommending an action.
    tools:
      - service: SupportService

agents:
  - name: order_ops
    model: DEFAULT
    instructions:
      - Resolve order issues step by step.
    skills:
      - order_resolution
    tools:
      - service: SupportService
    policy:
      requireConfirmation: true
      allowDestructive: false
      maxToolRounds: 4
    workspace:
      docs: agent-workspace
      blobs: agent-artifacts
      namespace: agents/order_ops
      tools: true
    http:
      path: /agents/order_ops
      useHttp: api
```

From a service handler:

```ts
const run = await trigger.context
  .agent('order_ops')
  .task('Resolve the delivery problem for order A-1042.')
  .input({ orderId: 'A-1042' })
  .run();
```

## Workflows orchestrate work

Workflows are code-defined Platform Flow wrappers. Steps can call services, run inference, start agents, wait for events, call pipelines, branch, retry, and set timeouts.

```ts
import { workflow } from '@3flows/intelligence';

export const triageWorkflow = workflow('support.triage')
  .input<{ text: string }>()
  .step('classify', (s) =>
    s.inference().choice('department')
      .state(({ input }) => input.text)
      .oneOf(['billing', 'shipping', 'technical'])
      .define()
  )
  .step('draft', (s) =>
    s.inference().chat()
      .instructions('Draft a short support reply.')
      .question(({ input, steps }) => `${steps.classify.value}: ${input.text}`)
      .define()
  )
  .returns(({ steps }) => ({ department: steps.classify.value, reply: steps.draft.text }));
```

Register the definition in the `workflows` service, then run it through an Intelligence service context:

```ts
this.workflows().register(triageWorkflow);
const result = await trigger.context.workflow('support.triage').input({ text }).run();
```

## Observability and validation are stricter

0.9 separates records deliberately:

- business data belongs in your own Platform docs/entities/domains,
- chatbot sessions/messages belong in `IntelligenceChatbotDomain`,
- agent runs/events/workspace indexes belong in `IntelligenceAgentDomain`,
- model/tool technical traceability belongs in `IntelligenceTraceDomain`.

Production apps should enable validation and inference policy:

```yaml
intelligence:
  strict: true
  inference:
    require:
      metadata: true
      timeout: true
    onViolation: error
```
