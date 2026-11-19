---
title: 28. Workflows
---

# 28. Workflows

**Where we are:** a new ticket is triaged from the queue, routed by a rule, and, where a person has to take over, the case researcher can prepare a brief.

**The problem:** *"what happens to a new ticket"* has become a process: load it, triage it, decide where it goes, and for some tickets prepare a brief. In the code, that process is a queue handler with a `try`/`catch`, and somebody has to remember to call `prepareCase`. When a ticket ends up as `triage-failed`, the log says that it failed, not where. And nobody can read the process without reading the handler.

## The solution: a workflow

A **workflow** is a process written down as named steps. It's the opposite of an agent: in an agent, the model chooses the next step; in a workflow, **we** do, once, in code. The model still answers questions, inside a step.

```ts title="intake.ts"
import { workflow } from '@3flows/intelligence';
import { statusAfterTriage } from './rules.js';
import type { StoredTicket } from './services.js';
import { triage } from './triage.js';

// What happens to a new ticket, step by step. The steps are ours and always run in this order:
// the model answers questions inside a step, it doesn't decide which step comes next.

type Intake = { ticketId: string };

export const intake = workflow('support.intake')
    .input<Intake>()

    .step('ticket', (s) => s
        .map(async ({ input, context }) => {
            const ticket = await context.doc().collection('tickets').by(input.ticketId).get<StoredTicket>();
            if (!ticket) throw new Error(`Ticket ${input.ticketId} not found`);
            return ticket;
        })
        .define())

    // The model decides what the ticket means. A provider hiccup gets a second attempt.
    .step('triage', (s) => s
        .map(({ steps, context }) => triage(context, steps.ticket))
        // highlight-start
        .retry({ attempts: 2 })
        .timeout('60s')
        // highlight-end
        .define())

    // Our rule decides where it goes, and the ticket is stored with both.
    .step('route', (s) => s
        .map(async ({ steps, context }) => {
            const status = statusAfterTriage(steps.triage);
            await context.doc().collection('tickets').by(steps.ticket.id).set({ ...steps.ticket, triage: steps.triage, status });
            return status;
        })
        .define())

    // Only where a person has to take over: the case researcher prepares the brief.
    // highlight-start
    .when('needsPerson', ({ steps }) => steps.route !== 'open')
    .step('brief', (s) => s
        .service('SupportService')
        .method('prepareCase')
        .input(({ input }: { input: Intake }) => ({ ticketId: input.ticketId }))
        .define())
    .end()
    // highlight-end

    .returns(({ steps }) => ({ status: steps.route }));
```

Read it top to bottom, and you know what happens to a ticket.

- **`step(name, …)`** is one unit of work with a name. The name shows up in the report.
- **`map(fn)`** is a step in plain code. It gets the workflow's **`input`**, the results of the steps before it in **`steps`**, typed, and the same **`context`** a handler has: `doc()`, `service()`, `inference()`, `agent()`.
- **`retry`** and **`timeout`** belong to the step. The retry that used to be a decision buried in a handler is now a line in the process.
- **`when(name, condition) … end()`** is a branch: its steps run only if the condition holds. Otherwise they're **skipped**, and the report says so.
- **`service(name).method(handler)`** calls a handler as a step. Here, `prepareCase` from the last chapter: nobody has to remember it any more.
- **`returns(...)`** is the workflow's result.

The rule that was a constant in the handler moves next to the other rule, in `rules.ts`:

```ts title="rules.ts"
/** Below this confidence in the department, a person routes the ticket. */
export const ROUTING_CONFIDENCE = 0.6;

export function statusAfterTriage(triage: { departmentConfidence: number }): 'open' | 'needs-routing' {
    return triage.departmentConfidence >= ROUTING_CONFIDENCE ? 'open' : 'needs-routing';
}
```

### More kinds of steps

`map` and `service` are enough here, because `triage()` already exists. The step builder has more:

| Step | Does |
|---|---|
| `s.map(fn)` | Plain code |
| `s.service(name).method(handler).input(…)` | Calls a service handler |
| `s.inference().check(name)`, `.choice(name)`, `.score(name)`, `.extract(name)`, `.chat()` | One fluent call as a step |
| `s.agent(name).task(…).input(…)` | Runs an agent and waits for its result |
| `s.pipeline(name)` | Runs a platform pipeline |
| `s.wait().event(name).correlate(…)` | Waits for something from outside, like an approval |

Workflows are built on the platform's [flows](https://3flows.github.io/platform-docs/docs/tutorial/flows): a workflow is a flow whose steps know about Intelligence.

### Registering and running it

A workflow is registered once, and then run by name through the trigger context, like an agent:

```ts title="services.ts"
/** The workflow is registered once, when the service is set up. */
async setup(): Promise<void> {
    this.workflows().register(intake);
}

/** Runs the intake of one ticket. A failed step is a state of the ticket, not a lost ticket. */
private async runIntake(context: IntelligenceServiceContext, ticketId: string): Promise<IntakeReport> {
    // highlight-start
    // report() doesn't throw when a step fails: it returns what happened, step by step.
    const report = await context.workflow('support.intake').input({ ticketId }).report();
    // highlight-end
    const steps = Object.fromEntries(Object.entries(report.steps).map(([name, step]) => [name, step.status]));

    if (steps.route !== 'succeeded') {
        const tickets = context.doc().collection('tickets');
        const ticket = await tickets.by(ticketId).get<StoredTicket>();
        context.log().stack(`intake of ${ticketId} failed at ${Object.keys(steps).find((name) => steps[name] === 'failed')}`).error();
        if (ticket) await tickets.by(ticketId).set({ ...ticket, status: 'triage-failed' });
    }
    return { status: report.status, steps };
}
```

A workflow has two terminal verbs:

- **`run()`** returns the workflow's result, and throws if a step failed.
- **`report()`** never throws for a failed step. It returns the status of the run and of every step: `succeeded`, `failed` or `skipped`.

[Chapter 23](./dont-block.md) said: *failure is a state*. `report()` is that idea for a whole process. The ticket still becomes `triage-failed`, but now we know which step it failed at.

The queue handler shrinks to one call. And because the workflow has a name, a person can start it too:

```ts title="services.ts"
// Intake from the queue: the workflow does the work, the report says how far it got.
route.mq().queue('ticket-created').do(async (message, trigger) => {
    const context = trigger.context as IntelligenceTrigger['context'];
    await this.runIntake(context, (message as { id: string }).id);
});

// Run the intake again, for a ticket whose triage failed. The same workflow, started by a person.
handler('retryIntake', t.object({ ticketId: t.string() }), IntakeReport, async ({ ticketId }, trigger) => {
    await trigger.ok(await this.runIntake(trigger.context, ticketId));
}),
```

## Call, agent, or workflow?

| | Who decides the next step | Use for |
|---|---|---|
| A call | there is only one | a question with an answer |
| An agent | the model | work whose path depends on what it finds |
| A workflow | our code | a process we can write down |

They combine. Here, the workflow is the process, its `triage` step makes five calls, and its `brief` step runs an agent. The outer structure is the most predictable one. That's a good default: **be as deterministic as the problem allows, and let the model choose only where choosing is the job.**

## Run it

```sh
yarn step:28
# create a ticket, as before, then run its intake again:
curl -X POST localhost:3000/retryIntake -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…"}'
```

```json
{
  "status": "succeeded",
  "steps": { "ticket": "succeeded", "triage": "succeeded", "route": "succeeded", "needsPerson": "succeeded", "brief": "skipped" }
}
```

A clear ticket: three steps ran, and the brief was skipped.

## Test it

A workflow can describe itself, so the process has a test of its own:

```ts title="step.test.ts"
test('the workflow describes itself: its steps, in order, by name and kind', () => {
    assert.deepEqual(intake.describe().steps.map((step) => [step.name, step.kind]), [
        ['ticket', 'map'],
        ['triage', 'map'],
        ['route', 'map'],
        ['needsPerson', 'when'],
        ['brief', 'service']
    ]);
});

test('an unsure routing takes the branch: the case researcher prepares a brief', async () => {
    ScriptedAI.reset(triageScript(unsure, 'Routing is unclear: the customer asks about a price and a defect.'));
    const { id } = await createTicket();

    assert.equal((await settled(id)).status, 'needs-routing');
    const brief = await eventually(() => post(`${API}/caseBrief`, { ticketId: id }).catch(() => undefined));
    assert.equal(brief.text, 'Routing is unclear: the customer asks about a price and a defect.');
});

test('a failing model fails the triage step after two attempts; the ticket keeps a state, and intake can be run again', async () => {
    ScriptedAI.reset(triageScript({ department: new Error('provider unavailable') }));
    const { id } = await createTicket();
    assert.equal((await settled(id)).status, 'triage-failed');
    // highlight-next-line
    assert.equal(ScriptedAI.requests.filter((request) => request.responseSchemaName === 'department').length, 2);

    ScriptedAI.reset(triageScript());
    const report = await post(`${API}/retryIntake`, { ticketId: id });

    assert.equal(report.steps.triage, 'succeeded');
    assert.equal((await getTicket(id)).status, 'open');
});
```

## What you learned

- **A workflow is a process as named steps**: `workflow(name).step(…).when(…).returns(…)`.
- **Steps are code, service calls, fluent calls or agents**, each with its own `retry` and `timeout`.
- **`report()` returns the status of every step** instead of throwing; `run()` returns the result.
- **Our code decides the path; the model works inside the steps.**

## Reviewer's view

> The intake of a ticket is a workflow: load, triage (two attempts), route by rule, and a brief from the case researcher where a person takes over.

`intake.ts` is the file to read: it's the process, in the order it happens. Check the branch condition, the retry, and what a failed step leaves behind. A retried step runs again from its start: here, `triage` only reads and decides, so running it twice is safe. A step that sends an email or charges a card needs more thought before it gets a `retry`.

[Sample: step 28](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/28-workflows) · Next: [What's next](./whats-next.md)
