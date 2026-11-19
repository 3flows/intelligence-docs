---
title: 5. Orchestrate with workflows
---

# 5. Orchestrate with workflows

A workflow is code-defined orchestration over Platform Flow. Use it when the process shape is known.

Workflows can combine:

- map/code steps,
- service calls,
- Fluent inference,
- agent tasks,
- branches,
- waits,
- pipeline calls,
- retry/timeouts,
- reports and outputs.

## Starter workflow

```ts title="starter/workflows.ts"
import { workflow } from '@3flows/intelligence';

export const quickAnswerWorkflow = workflow('starter.quickAnswer')
  .input<{ question: string }>()
  .step('answer', (s) =>
    s.inference().chat()
      .instructions('Answer in one short paragraph. If you are unsure, say what is missing.')
      .question(({ input }) => input.question)
      .timeout('20s')
      .define()
  )
  .returns(({ steps }) => ({ answer: steps.answer.text ?? '' }));
```

The workflow uses Fluent inference as a step and returns a clean application output.

## Run the workflow from a service

```ts title="starter/support-service.ts"
handler('askWithWorkflow', AskInput, AskOutput, async (input, trigger) => {
  this.ensureWorkflows();
  const output = await trigger.context.workflow('starter.quickAnswer').input(input).run();
  await trigger.ok(output as { answer: string });
});
```

Workflows need a service context so their steps can access Platform and Intelligence capabilities.

## Add branches and agents

A workflow can branch on typed decisions and call an agent only when needed:

```ts
const wf = workflow('support.intake')
  .input<{ text: string }>()
  .step('department', (s) =>
    s.inference().choice('department')
      .state(({ input }) => input.text)
      .oneOf(['billing', 'shipping', 'technical'])
      .define()
  )
  .when('shippingOnly', ({ steps }) => steps.department.value === 'shipping')
  .step('agent', (s) =>
    s.agent('starter_agent')
      .task(({ input }) => `Investigate shipping issue: ${input.text}`)
      .define()
  )
  .end();
```

## Workflow or collection?

Use `inference().collection(...)` for many similar independent items. Use a workflow for one business process with named steps, branches, waits, and a report.

## The complete path

You now have the main 0.9 building blocks:

1. `ais:` decides which model capabilities are available.
2. Fluent inference calls those capabilities from services.
3. Chatbots expose human-facing session surfaces.
4. Skills and agents package task-oriented model work.
5. Workflows orchestrate known business processes.

From here, add storage, domains, retrieval, observability, and tests according to your app's needs.
