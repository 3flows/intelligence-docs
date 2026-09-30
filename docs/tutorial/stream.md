---
title: 10. Stream
---

# 10. Stream

**Where we are:** customers chat with the assistant per ticket.

**The problem:** an answer takes three to five seconds, and the chat shows a spinner the whole time. Models generate text token by token; the first words are ready after a fraction of a second.

## The solution: `stream()`

`stream(...)` has the same chain as `ask(...)`, and returns the answer as a stream of events instead of one response:

```ts
const events = await assistant(trigger.context, ticket).stream(message);

for await (const event of events) {
    if (event.type === 'text.delta') { /* a piece of text */ }
    if (event.type === 'done') { /* the full response, with usage */ }
}
```

For the chat page, we forward the pieces over HTTP as they come. A handler answers once, so this is an HTTP **route**, which can answer with a stream. Routes get the platform's trigger type, so `intelligence(...)` gives the context its intelligent members:

```ts title="services.ts"
import { Readable } from 'node:stream';

routes(): Route {
    const route = super.routes();

    // highlight-start
    route.http().post('/chat/stream').do(async (params, trigger) => {
        const context = intelligence(trigger.context);
        const { ticketId, message } = ChatMessage.parse(params);   // routes don't validate: do it here
        const ticket = await context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
        if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

        const events = await assistant(context, ticket).stream(message);

        async function* text() {
            for await (const event of events) {
                if (event.type === 'text.delta') yield event.text;
            }
        }

        trigger.setReadble(Readable.from(text()), { mimeType: 'text/plain; charset=utf-8' });
        await trigger.ok();
    });
    // highlight-end

    return route;
}
```

`setReadble` hands the platform a stream to send as the response body; `ok()` starts sending. (Yes, `setReadble`: that's the method's name.)

The conversation is stored as with `ask`: the user message right away, the assistant's answer when the `done` event has passed.

## Run it

```sh
yarn step:10
curl -N -X POST localhost:3000/chat/stream -H 'Content-Type: application/json' \
  -d '{"ticketId":"5f0c…","message":"Which pads do I need for a Velo City 3?"}'
```

With `-N`, curl prints the words as they arrive.

## Test it

```ts title="step.test.ts"
test('streams the answer as plain text, piece by piece', async () => {
    ScriptedAI.reset(() => 'The Velo City 3 uses resin disc pads, type B01.');

    const response = await fetch('http://127.0.0.1:3000/chat/stream', { method: 'POST', /* … */ });
    const pieces: string[] = [];
    for await (const chunk of response.body!) pieces.push(Buffer.from(chunk).toString('utf8'));

    assert.equal(pieces.join(''), 'The Velo City 3 uses resin disc pads, type B01.');
});

test('the streamed turn is part of the conversation', async () => { /* … */ });
```

## When not to stream

- **Decisions and extractions.** A half-finished `choice` is useless; `ask` and wait.
- **Tool calls.** `stream()` doesn't run tools. For answers that need tools (next chapter), use `ask`.
- **Replies that must be checked.** A streamed reply is on the customer's screen before anyone could review it. [Chapter 20](./guard-the-output.md) comes back to this.
- **Background work.** Nobody watches the triage queue.

Stream when a person reads the text as it's written.

## What you learned

- **`stream(prompt)`** yields `text.delta` events and a final `done` with the full response.
- An HTTP route can answer with a stream: `trigger.setReadble(...)`, then `trigger.ok()`.
- Stream for people, not for code.

## Reviewer's view

> `POST /chat/stream` streams the assistant's answer as plain text.

Same conversation, same prompt, same context as `chat`; only the delivery changes. The route needs the same ownership check as `chat`.

[Sample: step 10](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/10-stream) · Next: [Act](./act.md)
