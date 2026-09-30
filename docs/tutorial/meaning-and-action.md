---
title: 8. The model decides meaning, the code decides action
sidebar_label: 8. Meaning and action
---

# 8. The model decides meaning, the code decides action

**Where we are:** every ticket has a triage record: department, topics, urgency, frustration, facts.

**The problem:** the team wants a queue per department, with the important tickets first. What's *important*? It's tempting to ask the model: *"Is this ticket high priority?"* But then a business rule hides inside a prompt, can't be unit-tested, and changes whenever the model does.

## The solution: rules in code, fed by decisions

The model delivers what the text means. What the business does with that is a rule, and rules are code:

```ts title="rules.ts"
import { t } from '@3flows/platform';

// Business rules: ordinary code, reviewed and tested like any other. The model only delivers the inputs.

export const Priority = t.enum(['normal', 'high']);
export type Priority = t.infer<typeof Priority>;

/** Urgent tickets and very frustrated customers go first. */
export function priorityOf(urgent: boolean, frustration: number): Priority {
    return urgent || frustration >= 7 ? 'high' : 'normal';
}
```

Triage applies it:

```ts title="triage.ts"
return {
    ...facts,
    // …
    urgent: urgent.value,
    frustration: frustration.value,
    // highlight-start
    // The model measured; our rule decides.
    priority: priorityOf(urgent.value, frustration.value)
    // highlight-end
};
```

And the queue is ordinary platform code:

```ts title="services.ts"
// Business rule at work: a department's tickets, high priority first.
handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
    const tickets = await trigger.context.doc().collection('tickets').find({ 'triage.department': department }).all<StoredTicket>();
    await trigger.ok(tickets.sort((a, b) => Number(b.triage.priority === 'high') - Number(a.triage.priority === 'high')));
})
```

## Why this split matters

| | In a prompt | In code |
|---|---|---|
| **Review** | hidden in wording | one line: `frustration >= 7` |
| **Test** | needs a model | a unit test, no model |
| **Change** | a prompt change, re-evaluate | a code change, same tests |
| **Stability** | moves when the model changes | stays |

This is the most useful design rule for AI features: **keep the part that can be wrong small, visible and testable.** The model can misjudge frustration; that's something you'll measure in Part 5. The rule itself can't be wrong about what it does.

## Part 2 in one file

Look at `triage.ts` now: department options with descriptions, a list of topics, a definition of urgent, an anchored scale, a schema of facts, and one rule. Everything the model decides about a ticket, and what we do with it, in about 80 lines. That's the file the team reviews, and the file Part 5 will measure and improve.

## Run it

```sh
yarn step:08
# create a few tickets as in the chapters before, then:
curl -X POST localhost:3000/queue -H 'Content-Type: application/json' -d '{"department":"technical"}'
```

## Test it

```ts title="step.test.ts"
test('the priority rule is ours, and tested without any model', () => {
    assert.equal(priorityOf(false, 6), 'normal');
    assert.equal(priorityOf(false, 7), 'high');
    assert.equal(priorityOf(true, 0), 'high');
});

test('a very frustrated customer comes first in the queue', async () => {
    await post('http://127.0.0.1:3000/createTicket', bell);
    ScriptedAI.reset(triageScript({ frustration: { value: 9, confidence: 0.8, reason: 'Third message.' } }));
    await post('http://127.0.0.1:3000/createTicket', derailleur);

    const queue = await post('http://127.0.0.1:3000/queue', { department: 'technical' });

    assert.deepEqual(queue.map((t: any) => [t.subject, t.triage.priority]), [['THIRD TIME', 'high'], ['Bells', 'normal']]);
});
```

## What you learned

- **The model decides what the text means; code decides what happens.**
- Business rules are ordinary functions, with unit tests and no model.
- `triage.ts` is the desk's AI policy, in one reviewable file.

## Reviewer's view

> Tickets get priority *high* when they're urgent or the frustration is 7 or more. Queues sort by priority.

Two things to review, in different places: the anchors of the frustration scale (what the model measures) and `priorityOf` (what we do with it). Changing one doesn't require changing the other.

[Sample: step 08](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/08-meaning-and-action) · Next: [Remember](./remember.md)
