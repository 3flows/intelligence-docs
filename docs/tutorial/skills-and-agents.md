---
title: 27. Skills and agents
---

# 27. Skills and agents

**Where we are:** the desk answers what it can, and hands over what it can't: unsure routing, payment details, replies that failed the review. Those tickets wait in `generalQueue` for a person.

**The problem:** the person who takes over starts from zero. They read the chat, look up the order, search the help center for the policy, and only then start to answer. It's the same research every time, and it's the part a model can do. But it isn't one call: what to look up next depends on what the last lookup returned.

## The solution: an agent, with a skill

Everything so far was a **call**: we decided what the model gets, it answered once (with a tool round or two in between). An **agent** is a model that works on a **task**: it decides which tool to use next, looks at the result, and goes on until it's done, inside limits we set.

That needs three things: tools, instructions for using them, and limits. All three are configuration.

### Tools, scoped by the ticket

The agent needs the ticket's chat and the customer's orders. Both become tools on `SupportService`, as in the last chapter. And the rule from [chapter 11](./act.md) still holds: the model fills in every argument, so no tool takes an email. The model names the **ticket**; the tool finds out whose ticket it is.

```ts title="services.ts"
// Tools for the case researcher. The ticket decides whose orders and which chat: the model only names the ticket.
tool('orderOfTicket', t.object({ ticketId: t.string(), number: t.string().describe('Order number like A-1042') }), Order.nullable(), async ({ ticketId, number }, trigger) => {
    const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.ok(null);
    // highlight-next-line
    await trigger.ok(await trigger.context.service('OrdersService').method('lookupOrder').input({ number, email: ticket.email }).call<Order | null>());
}, {
    name: 'order_of_ticket',
    description: 'Look up an order of the customer who opened the ticket: status, items and shipping date. null if the order is not theirs.',
    readOnly: true,
    tags: ['case']
}),

tool('chatOfTicket', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
    await trigger.ok(await chatOf(trigger.context, ticketId));
}, {
    name: 'chat_of_ticket',
    description: 'What the customer and the assistant have written in the chat of a ticket so far.',
    readOnly: true,
    tags: ['case']
}),
```

### A skill: how to do one kind of work

A **skill** bundles what's needed for one kind of work: instructions, and the tools to follow them. It's words and references, no code:

```yaml title="intelligence.yml"
# A skill: what an agent needs to know and may use for one kind of work. Words and tool references, no code.
skills:
  - name: case-research
    description: Collect the facts of a support case before a person answers it.
    instructions:
      - Read the chat of the ticket first, so you know what was already said.
      - If the ticket or the chat mentions an order number, look the order up. Never guess an order's status.
      - Search the help center for the policy that applies, and name the article.
    tools:
      - service: SupportService
        tags: [case]
      - service: HelpCenterService
        tags: [public]
```

The tool references are the ones from the chatbot: a service, narrowed by tag. The help center's search is reused as it is.

A skill is worth its own section because it's reusable. A second agent that needs to research a case gets the same skill, and with it the same instructions and exactly the same tools.

### An agent: who works, and inside which limits

```yaml title="intelligence.yml"
# An agent: a model that works on a task in several steps, with the tools of its skills, inside the limits of its policy.
agents:
  - name: case-researcher
    model: DEFAULT
    description: Prepares a brief for the person who takes over a ticket.
    instructions:
      - You prepare a brief for a support colleague at Velo, a bike shop, who takes over a ticket.
      - "The brief has three short parts: what the customer wants, the facts you found with their source, and a suggested next step."
      - You never write to the customer, and you never promise anything.
    skills:
      - case-research
    policy:
      allowDestructive: false   # read-only tools: nothing here changes data
      maxToolRounds: 4
```

- **`instructions`** say who the agent is and what it delivers. The skill's instructions are added to them.
- **`skills`** give it its tools. It has no others.
- **`policy`** is the limit: no tool that changes data, and at most four rounds of tool calls. An agent without limits is a loop with a credit card.

Agents keep their runs in a third domain:

```yaml title="intelligence.yml"
entities:
  backend: docs
  domains:
    - IntelligenceTrace
    - IntelligenceChatbot    # chatbot sessions and their messages
    - IntelligenceAgent      # agent runs, their steps and events
```

### Running it

The agent is reached through the trigger context, like `inference()`. It gets a **task** and an **input**:

```ts title="services.ts"
/** What the case researcher found out about a ticket, for the person who takes over. */
export const Brief = t.object({ ticketId: t.string(), runId: t.string(), status: t.string(), text: t.string(), steps: t.array(t.string()) });
export type Brief = t.infer<typeof Brief>;

/** The name of the agent in YAML. */
const RESEARCHER = 'case-researcher';

// Before a person takes over: the case researcher collects the facts. One run, with a record of what it did.
handler('prepareCase', t.object({ ticketId: t.string() }), Brief, async ({ ticketId }, trigger) => {
    const { doc, agent } = trigger.context;
    const ticket = await doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // highlight-start
    // stream() yields the agent's events while it works, and records them with the run. run() only returns the result.
    const events = agent(RESEARCHER)
        .using(trigger.context)
        .task('Prepare a brief for the colleague who takes over this ticket.')
        .input({ ticketId, subject: ticket.subject, body: ticket.body, triage: ticket.triage, escalation: ticket.escalation })
        .metadata({ subjectType: 'ticket', subjectId: ticketId, purpose: 'case-brief' })
        .stream();
    // highlight-end

    let run: AgentRunResult | undefined;
    const steps: string[] = [];   // the tools it called, in order
    for await (const event of events) {
        if (event.type === 'tool.started') steps.push(event.toolName);
        if (event.type === 'run.completed') run = event.result;
        if (event.type === 'run.failed') throw new Error(`The case researcher failed: ${String(event.error)}`);
    }
    if (!run) throw new Error('The case researcher did not finish');

    // One brief per ticket: a new one replaces the old one, and the old run goes with it.
    const previous = await doc().collection('briefs').by(ticketId).get<Brief>();
    if (previous) await forgetRun(previous.runId);

    const brief: Brief = { ticketId, runId: run.runId, status: run.status, text: run.text ?? '', steps };
    await doc().collection('briefs').by(ticketId).set(brief);
    await trigger.ok(brief);
}),
```

- **`using(trigger.context)`** gives the agent this request's context, so its tools run as part of it.
- **`task(...)`** is what to do, **`input(...)`** is what to do it with. The email isn't in the input: the agent doesn't need it, its tools do.
- An agent has two terminal verbs. **`run()`** waits and returns the result. **`stream()`** yields events while the agent works (`tool.started`, `tool.completed`, `text.delta`, `run.completed`, …), which is what we want here: the brief records which tools were used to write it.
- **The result is ours.** The brief is stored in `briefs`, under the ticket's id, like the chat. The run is the agent's record; the brief is the desk's.

The `email` never reached the model, the agent could only read, and it stopped after four rounds at the latest. That's the whole design: **the model chooses the next step; we choose the steps it can take.**

## Call, chatbot, or agent?

| | Use |
|---|---|
| We know what the model needs, and it answers once | a call: `chat`, `choice`, `check`, `score`, `extract` |
| A person talks to an assistant | a chatbot |
| The next step depends on the last result, and the model should choose it | an agent |

Most features are calls, and should stay calls: they're cheaper, faster and easier to test. An agent pays off when the path isn't known in advance.

## Run it

```sh
yarn step:27
# create a ticket and chat on it, as before, then:
curl -X POST localhost:3000/prepareCase -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…"}'
```

```json
{
  "ticketId": "5f0c…",
  "runId": "agent-run:7847…",
  "status": "completed",
  "text": "…",
  "steps": ["chat_of_ticket", "order_of_ticket", "search_help_center"]
}
```

## Test it

The scripted model plays the agent's part: one tool per round, then the brief.

```ts title="step.test.ts"
/** The agent works in rounds: one tool per round, then the brief. */
const researches = (ticketId: string, order: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    const call = (name: string, args: object) => ({ text: '', toolCalls: [{ id: `call-${done}`, name, arguments: args }] });
    if (done === 0) return call('chat_of_ticket', { ticketId });
    if (done === 1) return call('order_of_ticket', { ticketId, number: order });
    if (done === 2) return call('search_help_center', { query: 'wrong part delivered' });
    return 'Wants the right brake pads. Order A-1042 shipped (order_of_ticket). Suggest: send a return label.';
};

test('the agent works with its own instructions, those of its skill, and exactly the skill’s tools', async () => {
    ScriptedAI.reset(researches(id, 'A-1042'));
    await post(`${API}/prepareCase`, { ticketId: id });

    const [request] = ScriptedAI.requests;
    assert.match(String(request.instructions), /brief for a support colleague/);
    assert.match(String(request.instructions), /Read the chat of the ticket first/);
    // highlight-next-line
    assert.deepEqual(request.tools?.map((tool) => tool.name).sort(), ['chat_of_ticket', 'order_of_ticket', 'search_help_center']);
});

test('the tools are scoped by the ticket: another customer’s order stays hidden from the agent', async () => {
    ScriptedAI.reset(researches(id, 'A-1043'));
    await post(`${API}/prepareCase`, { ticketId: id });

    assert.equal(toolResults()[1], null);
});
```

The first test is the agent's permission list. The second is the one that matters most: asked for Grace's order on Ada's ticket, the tool answers `null`.

## Retention, once more

A run holds the task, the input and the events, and the agent's model calls are traced like any others, tagged with the run. So `closeTicket` from [chapter 25](./going-live.md) has more to delete:

```ts title="services.ts"
/** Retention for the agent domain: a run with its steps and events, and the model calls made for it. */
async function forgetRun(runId: string): Promise<void> {
    const { AgentRun, AgentStep, AgentEvent } = IntelligenceAgentDomain;
    const run = await AgentRun.find({ runId }).next();
    if (!run) return;
    const of = { run: run.reference() };
    for (const record of [...(await AgentEvent.find(of).limit(0).all()), ...(await AgentStep.find(of).limit(0).all())]) await record.delete();
    await run.delete();
    await forgetCallsOf('agent-run', runId);   // an agent tags its model calls with its run
}
```

`forgetCallsOf` now takes the subject it should forget: `'ticket'` and the ticket's id as before, or `'agent-run'` and the run's id.

## What you learned

- **An agent works on a task in several steps**: it chooses the tools, we choose which tools exist and how far it may go.
- **A skill** bundles instructions and tool references, for reuse. **`policy`** sets the limits.
- **`trigger.context.agent(name).using(context).task(…).input(…)`**, then `run()` for the result or `stream()` for the events.
- **Tools are scoped by what they look up themselves**, never by an argument the model fills in.
- **Runs live in the `IntelligenceAgent` domain**; what the desk needs from them, it stores itself.

## Reviewer's view

> An agent prepares a brief for tickets a person takes over: it reads the chat, looks up the customer's orders and searches the help center. Read-only, four tool rounds at most.

Read three things. The **tool list** (the test asserts it): is there anything on it that writes, sends or pays? The **scoping**: can any tool return data of another customer, whatever the model passes? And the **limits**: what does a run cost at most? The brief itself is a suggestion for a colleague. Nothing the agent writes reaches a customer.

[Sample: step 27](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/27-skills-and-agents) · Next: [Workflows](./workflows.md)
