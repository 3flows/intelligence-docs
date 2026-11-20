---
title: AG-UI and UI tools
---

# AG-UI and UI tools

A handler answers once, with data. A frontend with an assistant in it wants more: text as it's written, the tools as they're called, and things to render that aren't text. Two building blocks cover that.

## AG-UI: an agent or chatbot behind a frontend

AG-UI is an open protocol between a frontend and an agent: the frontend posts a **run** (the messages so far, and its state), and gets a stream of **events** back as server-sent events. Frontend libraries speak it.

Agents and chatbots are served over AG-UI with an `agui` block:

```yaml
agents:
  - name: desk-assistant
    agui:
      useHttp: console        # a server from `https`
      path: /desk-assistant

chatbots:
  - name: shop
    agui:
      useHttp: public
      path: /shop/agui
```

A run request:

```json
{
  "threadId": "t1",
  "runId": "r1",
  "state": { "ticketId": "5f0c…" },
  "messages": [{ "id": "m1", "role": "user", "content": "Where is the order of this ticket?" }]
}
```

The events of the answer:

| Event | |
|---|---|
| `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR` | The run |
| `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END` | The text, piece by piece |
| `TOOL_CALL_START`, `TOOL_CALL_END` | A tool is called: `toolCallName` |
| `TOOL_CALL_RESULT` | What the tool returned: `content`, as JSON |

### What the frontend sends reaches the model as data

`state`, `context`, `forwardedProps` and `resume` of a run request are passed to the model as structured context: the ticket on screen, the selected row, the values of a submitted form. They're data, not instructions: they're sent with the request, and never become part of the system message.

Say in the instructions where to look:

```yaml
    instructions:
      - The ticket the colleague is looking at is in the context you get, as state.ticketId.
```

### Agents and chatbots differ

| | Chatbot over AG-UI | Agent over AG-UI |
|---|---|---|
| A thread | A session: the history is kept | Every request starts a new run with the last user message as its task |
| Tool confirmations | From `state` or `resume` of the next request | Not over AG-UI: continue a waiting run with `resume`, from a service or the agent's HTTP routes |

## UI tools: the model asks, the frontend renders

A **UI tool** is a tool whose arguments are the specification of a UI element. The model decides *what* to show and fills in the specification; the frontend decides *how* it looks. The model never produces HTML, and the frontend never parses prose.

```ts
import { IntelligenceService, uiTool } from '@3flows/intelligence';

@Register()
export class ConsoleService extends IntelligenceService {
    handlers = () => [
        uiTool.card(),
        uiTool.keyValueList(),
        uiTool.confirmation()
    ];
}
```

Each is a `tool(...)` with a name (`show_card`), a description for the model, a typed schema, and the tag `ui`. Its handler returns the specification it was given. Offer them like any tool:

```yaml
skills:
  - name: console-ui
    instructions:
      - Show an order as a card, with its number as title and its status.
    tools:
      - service: ConsoleService
        tags: [ui]
```

In the event stream, the specification is the **result** of the tool call:

```json
{ "type": "TOOL_CALL_RESULT", "toolCallId": "…", "content": "{\"title\":\"Order A-1042\",\"status\":\"success\"}" }
```

### The twenty UI tools

| Helper | Tool | For |
|---|---|---|
| `uiTool.card()` | `show_card` | A summary of one thing: title, subtitle, body, status, actions |
| `uiTool.metric()` | `show_metric` | One number, with its change |
| `uiTool.table()`, `dataGrid()` | `show_table`, `show_data_grid` | Rows and columns |
| `uiTool.chart()` | `show_chart` | A chart |
| `uiTool.timeline()` | `show_timeline` | Events in order |
| `uiTool.keyValueList()` | `show_key_value_list` | Facts, as label and value |
| `uiTool.detailPanel()` | `show_detail_panel` | The details of one thing, in sections |
| `uiTool.callout()`, `status()` | `show_callout`, `show_status` | Something that must not be missed; a state |
| `uiTool.progress()`, `stepper()`, `taskList()` | `show_progress`, `show_stepper`, `show_task_list` | Where a piece of work stands |
| `uiTool.form()` | `show_form` | Ask for several values |
| `uiTool.confirmation()` | `show_confirmation` | Ask for a yes or no |
| `uiTool.picker()`, `filterPanel()` | `show_picker`, `show_filter_panel` | Ask for a choice; for filters |
| `uiTool.fileRequest()` | `show_file_request` | Ask for a file |
| `uiTool.rating()`, `feedback()` | `show_rating`, `show_feedback` | Ask how it went |

Every helper takes options to rename it, change its description or add tags: `uiTool.card({ name: 'show_order', tags: ['orders'] })`.

What the user does with a form, a picker or a confirmation comes back with the frontend's next run request, in `state` or `resume`, and reaches the model as context.

## Reviewer's view

Two questions. What can the model make the frontend show? Only what the specifications allow: no markup, no scripts; but the text in them is the model's, and may repeat whatever it read. And what does the frontend send back? `state` comes from a browser. It's data for the model, which then acts on it with its tools: tools that read by an id from the state must check that the user may see it.

The tutorial builds a console with both in [A console for the team](../tutorial/a-console.md).

:::caution In this version
An agent's AG-UI stream doesn't carry `TOOL_CALL_ARGS` events. Read a UI tool's specification from `TOOL_CALL_RESULT`. See [Known gaps](../guides/known-gaps.md#ag-ui).
:::
