---
title: Workflows
---

# Workflows

A **workflow** is a process written down as named steps. Your code decides the path, once; the model answers questions inside a step.

It's the counterpart to an [agent](./agents.md), where the model chooses the next step. Use a workflow when you can write the process down: *load the ticket, triage it, route it, and if a person has to take over, prepare a brief.*

```ts
import { workflow } from '@3flows/intelligence';

export const intake = workflow('support.intake')
    .input<{ ticketId: string }>()

    .step('ticket', (s) => s
        .map(({ input, context }) => context.doc().collection('tickets').by(input.ticketId).get<StoredTicket>())
        .define())

    .step('triage', (s) => s
        .map(({ steps, context }) => triage(context, steps.ticket))
        .retry({ attempts: 2 })
        .timeout('60s')
        .define())

    .when('needsPerson', ({ steps }) => steps.triage.departmentConfidence < 0.6)
    .step('brief', (s) => s
        .service('SupportService')
        .method('prepareCase')
        .input(({ input }: { input: { ticketId: string } }) => ({ ticketId: input.ticketId }))
        .define())
    .end()

    .returns(({ steps }) => ({ department: steps.triage.department }));
```

## The parts

| | |
|---|---|
| `workflow(name)` | Starts a definition. The name is how it's run |
| `.input<T>()` | The type of the workflow's input |
| `.step(name, (s) => … .define())` | One unit of work. The name appears in the report |
| `.when(name, condition) … .end()` | A branch: its steps run only if the condition holds, and are `skipped` otherwise |
| `.returns(fn)` | The workflow's result |

A step gets a context with the workflow's **`input`**, the results of the steps before it in **`steps`** (typed), and the same **`context`** a handler has: `doc()`, `service()`, `inference()`, `agent()`.

### Kinds of steps

| Step | Does |
|---|---|
| `s.map(fn)` | Plain code |
| `s.service(name).method(handler).input(…)` | Calls a service handler |
| `s.inference().check(name)`, `.choice(name)`, `.score(name)`, `.extract(name)`, `.chat()` | One fluent call as a step |
| `s.agent(name).task(…).input(…)` | Runs an agent and waits for its result |
| `s.pipeline(name)` | Runs a platform pipeline |
| `s.wait().event(name).correlate(…)` | Waits for something from outside, like an approval |

Steps take **`.retry({ attempts })`** and **`.timeout('60s')`**. A retried step runs again from its start: retry what reads and decides, and think twice about what sends or pays.

Workflows are built on the platform's [flows](https://3flows.github.io/platform-docs/docs/tutorial/flows): a workflow is a flow whose steps know about Intelligence.

## Registering and running

A workflow is registered once, by a service, and then run by name through the trigger context:

```ts
@Register()
export class SupportService extends IntelligenceService {
    async setup(): Promise<void> {
        this.workflows().register(intake);
    }
}
```

```ts
const result = await trigger.context.workflow('support.intake').input({ ticketId }).run();

const report = await trigger.context.workflow('support.intake').input({ ticketId }).report();
report.status;                 // 'succeeded' or 'failed'
report.steps.triage.status;    // 'succeeded', 'failed' or 'skipped'
report.output;                 // the result, when it succeeded
```

- **`run()`** resolves with the workflow's result, and throws if a step failed.
- **`report()`** doesn't throw for a failed step. It returns the status of the run and of every step, so a failure can become a state of your record instead of an exception.

`intake.describe()` returns the steps with their names and kinds: the process, as data, for a test or a diagram.

## Calls, agents and workflows together

They combine, and the usual shape is: a workflow outside, calls and agents inside its steps. The outer structure is then the most predictable one. Be as deterministic as the problem allows, and let the model choose only where choosing is the job.

For many similar items (a thousand tickets to classify), use `inference().collection(items)` instead: a workflow is one process, a collection is one call many times.

## Reviewer's view

The workflow file is the process, in the order it happens. Check the branch conditions, the retries, and what a failed step leaves behind.

The tutorial builds one in [Workflows](../tutorial/workflows.md).
