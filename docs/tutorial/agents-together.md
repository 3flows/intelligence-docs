---
title: 29. Agents that work together
---

# 29. Agents that work together

**Where we are:** the case researcher prepares a brief for tickets a person takes over. It reads the chat, looks up orders and searches the help center.

**The problem:** the researcher does two jobs. It collects the facts of a case, and it interprets Velo's rules: is this a return, a warranty case, a shipping problem? The second job keeps growing. Every new rule lands in the researcher's instructions, and the next agent that needs to know the rules would get a copy of them.

## The solution: a second agent, as a peer

Knowing the rules becomes an agent of its own, the **policy advisor**. The researcher keeps the case; when it needs a rule, it asks.

```yaml title="intelligence.yml"
skills:
  - name: case-research
    description: Collect the facts of a support case before a person answers it.
    instructions:
      - Read the chat of the ticket first, so you know what was already said.
      - If the ticket or the chat mentions an order number, look the order up. Never guess an order's status.
    tools:
      - service: SupportService
        tags: [case]

  # highlight-start
  - name: policy-research
    description: Find the shop policy that applies to a question, in the help center.
    instructions:
      - Search the help center before you answer. Answer only from what you found, and name the article.
      - If the help center has no answer, say so.
    tools:
      - service: HelpCenterService
        tags: [public]
  # highlight-end
```

The help center moved from the researcher's skill into a skill of its own. The two agents:

```yaml title="intelligence.yml"
agents:
  - name: case-researcher
    model: DEFAULT
    description: Prepares a brief for the person who takes over a ticket.
    instructions:
      - You prepare a brief for a support colleague at Velo, a bike shop, who takes over a ticket.
      - "The brief has three short parts: what the customer wants, the facts you found with their source, and a suggested next step."
      - For questions about returns, warranty or shipping rules, ask the policy advisor. Don't answer them from memory.
      - You never write to the customer, and you never promise anything.
    skills:
      - case-research
    # highlight-start
    # Colleagues it may ask. Each peer becomes a tool: ask_policy_advisor.
    peers:
      - agent: policy-advisor
    delegation:
      maxDepth: 1          # the advisor doesn't ask anyone else
      maxChildRuns: 3      # per run of the researcher
    # highlight-end
    policy:
      allowDestructive: false   # read-only tools: nothing here changes data
      maxToolRounds: 4

  - name: policy-advisor
    displayName: Policy Advisor
    model: DEFAULT
    description: Answers questions about Velo's returns, warranty and shipping rules, from the help center.
    capabilities: [returns-policy, warranty, shipping-rules]
    tags: [policy]
    instructions:
      - You answer a colleague's question about Velo's rules in two or three sentences.
    skills:
      - policy-research
    policy:
      allowDestructive: false
      maxToolRounds: 2
    # Listed when someone asks which agents there are.
    a2a:
      discoverable: true
```

- **`peers`** lists the agents an agent may ask. For the model, a peer is one more tool: `ask_policy_advisor`, with a `task` to give it. Its description comes from the peer's `description` and `capabilities`.
- **Asking a peer starts a run of that agent.** The advisor works with its own instructions, its own tools and its own limits, and its answer comes back to the researcher as the tool's result.
- **`delegation`** bounds it: how deep agents may ask each other, and how many runs one run may start. Cycles are refused unless `allowCycles` is set.

Nothing changes in the code. `prepareCase` still runs the researcher; that the researcher now asks someone is its own business.

### What each agent sees

This is the point of splitting them. The researcher no longer has the help center; the advisor has nothing else:

| | Tools | Gets |
|---|---|---|
| `case-researcher` | `chat_of_ticket`, `order_of_ticket`, `ask_policy_advisor` | The ticket |
| `policy-advisor` | `search_help_center` | The question the researcher asks. Not the ticket, not the customer |

A peer gets what the asking model writes into `task`, and nothing else. So the split is also a data boundary: the advisor can be asked by any agent, about any case, without ever seeing a customer.

## Cards: what an agent says about itself

Once there are several agents, something has to say which ones exist and what they're for. Every agent has a **card**: its name, its description, its skills and what it's capable of. It's derived from the configuration, in the shape of the A2A agent card.

Agents marked `a2a.discoverable` can be listed, and searched by capability, skill, tag or text:

```ts title="services.ts"
/** An agent, as others see it: taken from its card. */
const Colleague = t.object({ agent: t.string(), name: t.string(), description: t.string(), skills: t.array(t.string()) });

// Which agents are there, and what can they do? Cards of the agents that are marked discoverable.
handler('team', t.object({ capability: t.string().optional() }).optional(), t.array(Colleague), async (query, trigger) => {
    const agents = trigger.context.agents();
    // highlight-next-line
    const found = query?.capability ? agents.discover().capability(query.capability).list() : agents.cards().list();
    await trigger.ok(found.map(({ agent, card }) => ({
        agent,
        name: card.name,
        description: card.description ?? '',
        skills: (card.skills ?? []).map((skill) => skill.id)
    })));
}),
```

:::note Local discovery
Discovery finds the agents of this application. The cards have the A2A shape, so they can be published, but Intelligence doesn't call agents in other systems over the A2A protocol: a peer is always an agent of the same application.
:::

## Run it

```sh
yarn step:29
curl -X POST localhost:3000/team -H 'Content-Type: application/json' -d '{"capability":"warranty"}'
```

```json
[{ "agent": "policy-advisor", "name": "Policy Advisor", "description": "Answers questions about Velo's returns, warranty and shipping rules, from the help center.", "skills": ["policy-research"] }]
```

`prepareCase` works as before. Its brief now lists `ask_policy_advisor` among its steps.

## Test it

One scripted model plays both agents. It tells them apart by their tools:

```ts title="step.test.ts"
const isAdvisor = (request: AIChatRequest) => toolNames(request).includes('search_help_center');

/** Two agents, one scripted model: the researcher reads the chat and asks the advisor; the advisor searches and answers. */
const team = (ticketId: string) => (request: AIChatRequest) => {
    const done = request.messages.filter((message) => message.role === 'tool').length;
    if (isAdvisor(request)) {
        return done === 0
            ? call('advisor-1', 'search_help_center', { query: 'return wrong part' })
            : 'Unused parts can be returned within 30 days of delivery (Returns and refunds).';
    }
    if (done === 0) return call('researcher-1', 'chat_of_ticket', { ticketId });
    if (done === 1) return call('researcher-2', 'ask_policy_advisor', { task: 'What is the rule for returning a part that does not fit?' });
    return 'Wants to return brake pads that do not fit. Returns are possible within 30 days (policy advisor). Suggest: send a return label.';
};

test('each agent has its own tools: the researcher asks, only the advisor searches the help center', async () => {
    ScriptedAI.reset(team(id));
    await post(`${API}/prepareCase`, { ticketId: id });

    const researcher = ScriptedAI.requests.find((request) => !isAdvisor(request))!;
    const advisor = ScriptedAI.requests.find(isAdvisor)!;
    // highlight-start
    assert.deepEqual(toolNames(researcher), ['ask_policy_advisor', 'chat_of_ticket', 'order_of_ticket']);
    assert.deepEqual(toolNames(advisor), ['search_help_center']);
    // highlight-end
});

test('the advisor works inside the researcher’s run, and its answer comes back as a tool result', async () => {
    // …
    // The advisor got the question, not the ticket.
    assert.doesNotMatch(JSON.stringify(advisor.inputs), /ada@example\.com/);
});
```

## Retention, again

Asking a peer leaves records: a delegation, and the peer's run with its own model calls. `forgetRun` from [chapter 27](./skills-and-agents.md) follows them:

```ts title="services.ts"
const events = await AgentEvent.find(of).limit(0).all();
// What it asked its peers goes too: the delegations, and the runs of the colleagues it asked.
const asked = events.flatMap((event) => {
    const payload = event.data.payload as { type?: string; childRunId?: string };
    return payload.type === 'delegation.completed' && payload.childRunId ? [payload.childRunId] : [];
});
const records = [...events, ...(await AgentStep.find(of).limit(0).all()), ...(await AgentDelegation.find({ parentRun: run.reference() }).limit(0).all())];
for (const record of records) await record.delete();
await run.delete();
for (const childRunId of asked) await forgetRun(childRunId);
```

## What you learned

- **`peers` lets an agent ask another agent**, as a tool. The peer runs with its own instructions, tools and limits.
- **A peer sees only the task it's given.** Splitting agents splits what each one can see and do.
- **`delegation`** limits depth and number of peer runs.
- **Every agent has a card.** `agents().cards()` lists the discoverable ones, `agents().discover()` finds them by capability, skill, tag or text.

## Reviewer's view

> The case researcher asks a policy advisor for Velo's rules. The advisor answers from the help center and never sees the ticket.

Two agents mean two permission lists, and the tests assert both. Check what crosses between them: the researcher writes the question itself, so it could put customer details into it. The instructions say what to ask; nothing enforces it. If the advisor must never receive personal data, that needs a check of its own, like the guardrails of [chapter 19](./guard-the-input.md). And check the cost: one run of the researcher may now start up to three runs of the advisor.

[Sample: step 29](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/29-agents-together) · Next: [Confirm before acting](./confirm-before-acting.md)
