---
title: 31. A console for the team
---

# 31. A console for the team

**Where we are:** the team has briefs, and decides what the researcher may do. All of it through handlers: a request goes in, a JSON document comes out.

**The problem:** Velo builds a console for the support team: a ticket on the left, an assistant on the right. A colleague asks *"where's the order of this ticket?"* and expects to see the assistant work, and to see an order, not a paragraph about an order. A handler that answers once with text does neither.

## The solution: AG-UI, and UI tools

Two things are missing, and each has a building block.

- **A protocol between an agent and a frontend.** [AG-UI](https://docs.ag-ui.com) is an open one: the frontend sends a run request, the agent answers with a stream of events. Frontend libraries speak it, so the console doesn't have to invent its own.
- **A way for the model to ask for UI.** A **UI tool** is a tool whose arguments are the specification of a UI element: a card, a table, a form. The model fills in the specification; the frontend renders it. The model never writes HTML.

### The agent, served over AG-UI

The console gets an agent of its own. It reads cases like the researcher, and it may show things:

```yaml title="intelligence.yml"
  # The assistant in the team's console. A colleague asks, it looks things up and shows them.
  - name: desk-assistant
    displayName: Desk Assistant
    model: DEFAULT
    description: Answers the support team's questions about a ticket, in the console.
    instructions:
      - You help a support colleague at Velo who is looking at a ticket in the console.
      - The ticket they are looking at is in the context you get, as state.ticketId.
    skills:
      - case-research
      - case-actions       # send_return_label: it waits for a yes, and the console asks for it
      - console-ui
    peers:
      - agent: policy-advisor
    delegation:
      maxDepth: 1
      maxChildRuns: 2
    policy:
      allowDestructive: false
      maxToolRounds: 4
    # highlight-start
    # Served to a frontend that speaks AG-UI, and with run routes and its card over HTTP.
    agui:
      useHttp: console
      path: /desk-assistant
    http:
      useHttp: console
      path: /agents/desk-assistant
    # highlight-end
    a2a:
      discoverable: true
```

Skills pay off here: `case-research` is the researcher's skill, reused as it is. The assistant doesn't get `case-actions`, so it can't send anything.

Like the chatbot in [chapter 26](./a-chatbot.md), it gets a server of its own:

```yaml title="intelligence.yml"
  # The team's console talks to this one: the desk assistant, over AG-UI.
  - name: console
    port: 3002
```

- **`agui`** serves the agent at `POST /desk-assistant`. The request is an AG-UI run: the messages so far, and the frontend's **state**. The response is a stream of server-sent events.
- **`http`** adds plain run routes under its path (`POST /runs`, `POST /runs/stream`, `GET /runs/:runId`, `GET /runs/:runId/events`, `/resume`, `/steer`, `/stop`) and the agent's card at `GET /card`.

### What a run looks like

```sh
curl -N -X POST localhost:3002/desk-assistant -H 'Content-Type: application/json' -d '{
  "threadId": "t1", "runId": "r1",
  "state": { "ticketId": "5f0c…" },
  "messages": [{ "id": "m1", "role": "user", "content": "Where is the order of this ticket?" }]
}'
```

```txt
RUN_STARTED
TEXT_MESSAGE_START
TOOL_CALL_START      order_of_ticket
TOOL_CALL_ARGS       { "ticketId": "5f0c…", "number": "A-1042" }
TOOL_CALL_END
TOOL_CALL_RESULT     { "number": "A-1042", "status": "shipped", … }
TOOL_CALL_START      show_card
TOOL_CALL_ARGS       { "title": "Order A-1042", "status": "success", … }
TOOL_CALL_END
TOOL_CALL_RESULT     { "title": "Order A-1042", "status": "success", … }
TEXT_MESSAGE_CONTENT The order has shipped.
TEXT_MESSAGE_END
RUN_FINISHED
```

The frontend shows the tool calls as they happen (*looking up the order…*), and the text as it's written.

**`state`** is how the frontend tells the agent what's on screen. The assistant's instructions say where to look: `state.ticketId`. The colleague writes *"this ticket"*, and the model knows which one. State is passed to the model as data, in its context, never as instructions.

### UI tools

```ts title="console.ts"
import { Register } from '@3flows/platform';
import { IntelligenceService, uiTool } from '@3flows/intelligence';

// UI tools: what an agent may ask a frontend to show. Each one is a tool with a typed specification;
// the handler does nothing but hand the specification back. Rendering is the frontend's job.

@Register()
export class ConsoleService extends IntelligenceService {
    handlers = () => [
        uiTool.card(),            // show_card: a summary of one thing, here an order
        uiTool.keyValueList(),    // show_key_value_list: facts, as label and value
        uiTool.callout()          // show_callout: one thing the reader must not miss
    ];
}
```

A UI tool is a `tool(...)` like any other: it has a name (`show_card`), a description that tells the model when to use it, a schema for its arguments, and the tag `ui`. Its handler returns the specification unchanged. So in the event stream, **the result of `show_card` is the card**: that's what the frontend renders.

```json
{ "title": "Order A-1042", "subtitle": "brake pads, bell", "status": "success", "body": "Shipped on 2 May." }
```

The agent gets them through a skill, which also says how to use them:

```yaml title="intelligence.yml"
  - name: console-ui
    description: Show results in the team's console instead of describing them in text.
    instructions:
      - Show an order as a card, with its number as title and its status.
      - Show several facts as a key-value list.
      - Then answer in one sentence. Don't repeat in text what you have shown.
    tools:
      - service: ConsoleService
        tags: [ui]
```

There are twenty of them:

| | |
|---|---|
| Showing | `card`, `metric`, `table`, `dataGrid`, `chart`, `timeline`, `keyValueList`, `detailPanel`, `callout`, `status`, `progress`, `stepper`, `taskList` |
| Asking | `form`, `confirmation`, `picker`, `filterPanel`, `fileRequest`, `rating`, `feedback` |

Offer the few your frontend can render. Every tool an agent has is one more thing it may choose.

## A yes, in the console

In [chapter 30](./confirm-before-acting.md) the case researcher wanted to send a return label, and waited. A colleague answered through a handler. In the console, the colleague is already there. So the desk assistant gets the same skill, `case-actions`, and with it `send_return_label`, which is marked `requiresConfirmation`.

The colleague writes *"Send the customer a return label."* The assistant calls the tool. The tool doesn't run; the run ends, and its last event says why:

```json
{
  "type": "RUN_FINISHED",
  "outcome": {
    "type": "interrupt",
    "interrupts": [{
      "id": "agent-run:7c1e…#0",
      "reason": "tool_confirmation",
      "message": "Confirmation is required before executing send_return_label.",
      "metadata": { "agentRunId": "agent-run:7c1e…", "tool": "send_return_label", "arguments": { "ticketId": "5f0c…" } }
    }]
  }
}
```

An **interrupt** is a question the run stopped on. The console shows it: *Send a return label for this ticket? Yes / No.* The answer is the next request, which carries no message, only the answer:

```sh
curl -N -X POST localhost:3002/desk-assistant -H 'Content-Type: application/json' -d '{
  "threadId": "t1", "runId": "r2",
  "resume": [{ "interruptId": "agent-run:7c1e…#0", "status": "resolved" }]
}'
```

- **`resolved`** continues the same run. Exactly the tools of the answered interrupts are confirmed, and this time `send_return_label` runs.
- **`cancelled`** stops the run. Nothing is sent, and the run ends with `outcome: { "type": "cancelled" }`.
- **An interrupt is answered once.** A second answer gets a `RUN_ERROR`: the run isn't waiting any more.

As in chapter 30, a continued run does its task again from the start, now with the confirmation. What it does before the confirmed tool must be safe to do twice: here it's reading.

## The same tools, for other assistants: MCP

The console isn't the only place where someone wants to search Velo's help center. Colleagues use assistants of their own, in their editor or their desktop. Those speak **MCP**, and the platform can serve a service's tools as an MCP server:

```yaml title="intelligence.yml"
# The help center's tools, for assistants outside this application: an MCP server.
# Of a service's handlers, only those marked with tool(...) are offered.
mcps:
  - name: help-center
    port: 3003
    basepath: /mcp
    path: /help-center
    services:
      - name: HelpCenterService
```

The name and description the MCP client sees are the ones on `tool(...)`. `importArticles`, which isn't marked, isn't offered. One definition of the tool now serves `chat()`, the chatbot, two agents and MCP.

An agent can be offered over MCP too, with an `mcp` block: other assistants then get tools to run it (`run_desk_assistant`) and to follow the run.

## Run it

```sh
yarn step:31
curl -X POST localhost:3000/orders/seedOrders
# create a ticket, as before, then the curl from above
curl localhost:3002/agents/desk-assistant/card
```

## Test it

A test is a frontend that reads the events:

```ts title="step.test.ts"
/** What a frontend sends to the agent, and the events it gets back as server-sent events. */
async function agui(body: Record<string, unknown>): Promise<Array<Record<string, any>>> {
    const response = await fetch(`${CONSOLE}/desk-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 'thread-1', ...body })
    });
    assert.equal(response.status, 200);
    return (await response.text()).split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)));
}

/** One AG-UI run: a message of the colleague, and what the console knows as state. */
const aguiRun = (message: string, state: Record<string, unknown>) =>
    agui({ runId: 'run-1', state, messages: [{ id: 'm1', role: 'user', content: message }] });

test('a UI tool hands its specification to the frontend: the card arrives as the arguments of show_card', async () => {
    const events = await aguiRun('Where is the order of this ticket?', { ticketId: id });

    const shown = events.find((event) => event.type === 'TOOL_CALL_START' && event.toolCallName === 'show_card')!;
    const args = events.find((event) => event.type === 'TOOL_CALL_ARGS' && event.toolCallId === shown.toolCallId)!;
    // highlight-next-line
    assert.deepEqual(JSON.parse(args.delta), card);
});

test('an action waits for a yes in the console: the run ends with an interrupt, and the answer continues it', async () => {
    ScriptedAI.reset(sendsLabel(id));
    const events = await aguiRun('Send the customer a return label.', { ticketId: id });

    // The run didn't fail and didn't finish: it stopped on a question, with what it wants to do.
    const { outcome } = events.at(-1)!;
    assert.equal(outcome.type, 'interrupt');
    const [interrupt] = outcome.interrupts;
    assert.deepEqual([interrupt.metadata.tool, interrupt.metadata.arguments], ['send_return_label', { ticketId: id }]);
    assert.deepEqual(await post(`${API}/returnLabel`, { ticketId: id }), { sent: false });

    // The colleague clicks yes. The console answers the interrupt by its id, and the same run goes on.
    // highlight-next-line
    const resumed = await agui({ runId: 'run-2', resume: [{ interruptId: interrupt.id, status: 'resolved' }] });
    assert.equal(resumed.at(-1)!.outcome.type, 'success');
    assert.deepEqual(await post(`${API}/returnLabel`, { ticketId: id }), { sent: true });

    // An interrupt is answered once.
    const again = await agui({ runId: 'run-3', resume: [{ interruptId: interrupt.id, status: 'resolved' }] });
    assert.equal(again.at(-1)!.type, 'RUN_ERROR');
});

test('a no stops the run, and nothing is sent', async () => { /* … status: 'cancelled' … */ });

test('what the frontend knows reaches the model as context: the ticket on screen', async () => {
    await aguiRun('Where is the order of this ticket?', { ticketId: id });

    const [request] = ScriptedAI.requests;
    assert.match(JSON.stringify(request.inputs), new RegExp(id));
    // Its tools: reading the case, asking the policy advisor, the three things it may show, and one action, which waits for a yes.
    assert.deepEqual(request.tools?.map((tool) => tool.name).sort(), [
        'ask_policy_advisor', 'chat_of_ticket', 'order_of_ticket', 'send_return_label', 'show_callout', 'show_card', 'show_key_value_list'
    ]);
});

test('the help center is an MCP server: it offers the marked tool, and nothing else of the service', async () => { /* … */ });
test('the same agent has run routes and a card over HTTP', async () => { /* … */ });
```

## What you learned

- **`agui` serves an agent (or a chatbot) to a frontend** as a stream of AG-UI events: text, tool calls, results.
- **The frontend's `state` reaches the model as context.**
- **UI tools let a model ask for UI** by filling in a typed specification. The frontend renders; the model never writes markup.
- **A run that needs a yes ends with an interrupt.** The frontend answers it with `resume`, and the same run continues or stops.
- **`mcps` serves a service's marked tools** to assistants outside the application.

## Reviewer's view

> The team's console talks to a desk assistant over AG-UI. The assistant reads cases and shows orders as cards. It can do one thing for a customer, send a return label, and only after the colleague in the console said yes. The help center search is also offered as an MCP server.

A second server and a third are two more ways in. Who can reach port 3002, and who 3003? The assistant reads any ticket whose id is in the state: the console must only send ids the colleague may see, and for stricter rules the tools check it themselves. And `state` comes from a browser. It's data for the model, but the model acts on it: treat it like any other input from outside.

[Sample: step 31](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/31-a-console) · Next: [Many at once](./many-at-once.md)
