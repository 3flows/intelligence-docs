# Workflows

Workflows are code-defined orchestration over Platform Flow. They give Intelligence apps a typed way to combine deterministic code, service calls, inference, agents, waits, branches, retries, timeouts, and reports.

Use a workflow when the shape of the business process is known and should be observable. Use an agent when the model should decide how to pursue a task.

## Define a workflow

```ts
import { workflow } from '@3flows/intelligence';

export const triageWorkflow = workflow('support.triage')
  .input<{ text: string; ticketId: string }>()
  .state<{ flags: string[] }>({ flags: [] })
  .step('department', (s) =>
    s.inference().choice('department')
      .state(({ input }) => input.text)
      .oneOf(['billing', 'shipping', 'technical'])
      .define()
  )
  .step('draft', (s) =>
    s.inference().chat()
      .instructions('Draft a concise support reply.')
      .question(({ input, steps }) => `${steps.department.choice}: ${input.text}`)
      .timeout('20s')
      .define()
  )
  .returns(({ steps }) => ({
    department: steps.department.choice,
    reply: steps.draft.text
  }));
```

## Register and run

Workflows run with a service context so steps can access Platform and Intelligence capabilities.

```ts
import { IntelligenceService, handler } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';
import { triageWorkflow } from './workflows.js';

@Register()
export class SupportService extends IntelligenceService {
  private registered = false;

  private ensureWorkflows() {
    if (this.registered) return;
    this.workflows().register(triageWorkflow);
    this.registered = true;
  }

  handlers = () => [
    handler('triage', t.object({ text: t.string() }), t.object({ department: t.string(), reply: t.string() }), async (input, trigger) => {
      this.ensureWorkflows();
      await trigger.ok(await trigger.context.workflow('support.triage').input(input).run());
    })
  ];
}
```

## Step types

| Step builder | What it does |
| --- | --- |
| `s.map(fn)` | Run arbitrary deterministic code in the workflow context |
| `s.service(name).method(handler)` / `s.call(name)` | Call a Platform service handler |
| `s.inference().chat()` | Run a Fluent chat call |
| `s.inference().choice()` | Choose one or many options |
| `s.inference().check()` | Return an accept/reject decision |
| `s.inference().score()` | Score text against criteria |
| `s.inference().extract()` | Extract structured data |
| `s.inference().embedding()` | Create embeddings |
| `s.inference().ocr()` | Run OCR |
| `s.inference().moderation()` | Run moderation |
| `s.inference().image()` | Generate images |
| `s.inference().speech()` | Generate speech |
| `s.agent(name)` | Start an agent task |
| `s.pipeline(name)` | Call a Platform pipeline |
| `s.wait()` | Wait for an external event/correlation |

Most steps support `retry(...)` and `timeout(...)`.

## Branches

```ts
const wf = workflow('support.escalation')
  .input<{ text: string }>()
  .step('risk', (s) => s.inference().check('legal-risk').state(({ input }) => input.text).define())
  .when('legalOnly', ({ steps }) => steps.risk.accepted)
  .step('createCase', (s) => s.service('LegalService').method('createCase').input(({ input }) => input).define())
  .end();
```

If the condition is false, the branch steps are skipped in the report.

## Reports vs outputs

`run()` returns the workflow output or throws if the workflow fails. `report()` returns the full Platform Flow report without throwing for workflow failures.

```ts
const output = await trigger.context.workflow('support.triage').input(input).run();
const report = await trigger.context.workflow('support.triage').input(input).report();
```

Use reports for dashboards, audits, retries, and tests that need step-level status.

## Workflow context

Every step resolver receives:

```ts
type WorkflowStepContext = {
  input: unknown;
  state: unknown;
  steps: Record<string, unknown>;
  reports: Record<string, unknown>;
  context: IntelligenceServiceContext;
  metadata: Record<string, unknown>;
  signal: AbortSignal;
  workflow: { name: string; runId: string };
};
```

`context` is the same enriched Intelligence service context used by handlers.
