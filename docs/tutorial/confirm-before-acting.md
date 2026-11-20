---
title: 30. Confirm before acting
---

# 30. Confirm before acting

**Where we are:** the case researcher reads, asks and writes a brief. Everything it can do is read-only.

**The problem:** the most common next step in a brief is *"send a return label"*. The colleague reads the brief, agrees, opens the shipping system and sends the label. The agent could do that last part. But a label is an email to a customer, and Velo pays for the parcel. That's not something a model decides on its own.

[Chapter 21](./humans-in-the-loop.md) listed the ways to keep a person in the loop. The last one was *wait for approval*, for anything that can't be taken back. This is it.

## The solution: a tool that needs a yes

The action becomes a tool, marked with **`requiresConfirmation`**:

```ts title="services.ts"
// The one thing the researcher may do for a customer. It reaches the customer, so a person says yes first.
tool('sendReturnLabel', t.object({ ticketId: t.string() }), t.object({ sent: t.boolean() }), async ({ ticketId }, trigger) => {
    const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.ok({ sent: false });
    // Stands in for the shop's shipping system.
    await trigger.context.doc().collection('labels').by(ticketId).set({ ticketId, email: ticket.email, sentAt: new Date().toISOString() });
    await trigger.ok({ sent: true });
}, {
    name: 'send_return_label',
    description: 'Send the customer who opened the ticket a prepaid return label by email.',
    // highlight-next-line
    requiresConfirmation: true,
    tags: ['case-action']
}),
```

The researcher gets it through a skill that says when to use it:

```yaml title="intelligence.yml"
skills:
  - name: case-actions
    description: What may be done for a customer while a case is prepared.
    instructions:
      - If the policy advisor confirmed that the customer may return an item, send the customer a return label.
      - Do nothing else for the customer.
    tools:
      - service: SupportService
        tags: [case-action]
```

```yaml title="intelligence.yml"
    skills:
      - case-research
      - case-actions
```

### What happens when the agent calls it

The tool doesn't run. Instead:

1. The model gets an answer that says a confirmation is required, and goes on. It can still finish its brief.
2. The run ends with the status **`waiting`**, not `completed`.
3. The run remembers what it's waiting for: the tool and the arguments the model wanted to call it with.

Three things make a tool wait like this:

| | |
|---|---|
| `requiresConfirmation: true` on the tool | This tool always needs a yes |
| `destructive: true` on the tool | Tools that change or delete data need a yes, unless the agent's policy says `allowDestructive: true`. With `allowDestructive: false`, the agent doesn't get the tool at all |
| `requireConfirmation: true` in the agent's `policy` | Every tool of this agent needs a yes |

The brief records it:

```ts title="services.ts"
export const Brief = t.object({
    ticketId: t.string(),
    runId: t.string(),
    status: t.string(),                 // completed, or waiting: the agent wants to do something that needs a yes
    text: t.string(),
    steps: t.array(t.string()),
    waitingFor: t.array(t.object({ tool: t.string(), arguments: t.any() }))
});
```

```ts title="services.ts"
/** Stores what a run of the case researcher came to: its text, the tools it used, and what it's waiting for. */
private async keepBrief(context: IntelligenceServiceContext, ticketId: string, run: AgentRunResult): Promise<Brief> {
    // The run recorded what the agent did: the tools it called, in order.
    const events = await context.agent(RESEARCHER).run(run.runId).events();
    const steps = events.flatMap((event) => (event.type === 'tool.started' ? [event.toolName] : []));
    // highlight-next-line
    const pending = run.status === 'waiting' ? ((run.metadata?.pendingInteractions ?? []) as Array<{ tool: string; arguments: unknown }>) : [];

    const brief: Brief = {
        ticketId, runId: run.runId, status: run.status, text: run.text ?? '', steps,
        waitingFor: pending.map(({ tool, arguments: args }) => ({ tool, arguments: args }))
    };
    await context.doc().collection('briefs').by(ticketId).set(brief);
    return brief;
}
```

### The decision

A colleague sees the brief, and what it's waiting for: *send a return label for ticket 5f0c*. They decide:

```ts title="services.ts"
// A person answers what the agent is waiting for. Yes: the run goes on, and this time the tool runs. No: the run stops.
handler('decideCase', t.object({ ticketId: t.string(), approve: t.boolean() }), Brief, async ({ ticketId, approve }, trigger) => {
    const { doc, agent } = trigger.context;
    const brief = await doc().collection('briefs').by(ticketId).get<Brief>();
    if (!brief) return trigger.notFound(`Ticket ${ticketId} has no brief`);
    if (brief.status !== 'waiting') return trigger.notFound(`The brief of ticket ${ticketId} isn't waiting for a decision`);

    const run = agent(RESEARCHER).using(trigger.context).run(brief.runId);
    // highlight-start
    const result = approve
        ? await run.resume().context({ confirmedTools: brief.waitingFor.map((interaction) => interaction.tool) }).submit()
        : await run.reason('declined by the team').stop();
    // highlight-end

    await trigger.ok(await this.keepBrief(trigger.context, ticketId, result));
}),
```

- **`run(runId)`** addresses the run that waits.
- **`resume()`** continues it. `confirmedTools` names what was approved: only the tools the colleague saw, not *everything*.
- **`stop()`** ends it. Nothing was sent, and the run says why it ended.
- Only a run that is `waiting` can be resumed. A second yes on the same run is refused.

One thing to know about `resume`: the agent works on its task **again**, this time with the confirmation. It reads, asks the advisor and calls the tool, which now runs. So a resumed run costs a second pass, and the steps before the confirmed tool must be safe to repeat. Here they only read.

## Run it

```sh
yarn step:30
curl -X POST localhost:3000/prepareCase -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…"}'
```

```json
{ "status": "waiting", "text": "…", "steps": ["ask_policy_advisor", "send_return_label"],
  "waitingFor": [{ "tool": "send_return_label", "arguments": { "ticketId": "5f0c…" } }] }
```

```sh
curl -X POST localhost:3000/decideCase -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…","approve":true}'
```

## Test it

```ts title="step.test.ts"
test('the agent may ask for the label, but the tool does not run: the run waits', async () => {
    const brief = await post(`${API}/prepareCase`, { ticketId: id });

    assert.equal(brief.status, 'waiting');
    assert.deepEqual(brief.waitingFor, [{ tool: 'send_return_label', arguments: { ticketId: id } }]);
    // highlight-next-line
    assert.deepEqual(await label(), { sent: false });
    // The model was told why nothing happened, and wrote its brief accordingly.
    const last = ScriptedAI.requests.filter((request) => !isAdvisor(request)).at(-1)!;
    assert.equal(lastToolResult(last).interactionRequired, true);
});

test('yes: the run goes on, the tool runs, and the brief says so', async () => {
    await post(`${API}/prepareCase`, { ticketId: id });

    const brief = await post(`${API}/decideCase`, { ticketId: id, approve: true });

    assert.equal(brief.status, 'completed');
    assert.deepEqual(await label(), { sent: true });
});

test('no: the run is stopped, and nothing is sent', async () => { /* … status 'stopped', no label */ });
test('a decision is only possible while the run waits', async () => { /* … a second yes is refused */ });
```

The first test is the important one: whatever the model does, no label leaves without a decision.

## What you learned

- **`requiresConfirmation` on a tool** makes an agent stop and wait instead of running it.
- **A waiting run** says what it's waiting for: `status: 'waiting'`, and the pending tool calls in its metadata.
- **`run(id).resume().context({ confirmedTools })`** continues it; **`run(id).stop()`** ends it.
- **A resumed run does its work again.** Keep everything before the confirmed tool repeatable.

## Reviewer's view

> The case researcher can ask for a return label. The label is only sent after a colleague approved it; a declined request stops the run.

Read the marking, not the prompt: `requiresConfirmation` is on the tool, so no instruction and no model can skip it. Check what the colleague approves. They see the tool and its arguments; is that enough to decide? And check the repeat: between the request and the yes, the case may have changed. The resumed run reads it again, which is right; the tool should still check what it does, as any handler would.

[Sample: step 30](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/30-confirm-before-acting) · Next: [A console for the team](./a-console.md)
