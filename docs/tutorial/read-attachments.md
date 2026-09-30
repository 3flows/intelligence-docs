---
title: 13. Read attachments
---

# 13. Read attachments

**Where we are:** the assistant chats, and looks up orders.

**The problem:** customers attach things: a delivery note, an error log from an e-bike display, a list of parts. The answer is often in there, and the model never sees it.

## The solution: files from `blobs`

Attachments are files, so they go into the platform's [`blobs`](https://3flows.github.io/platform-docs/). Tickets remember their names, and model calls add them with `withBlob(...)`:

```ts title="services.ts"
export const Attachment = t.object({ name: t.string(), content: t.string().describe('Text content') });

export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string(),
    // highlight-next-line
    attachments: t.array(Attachment).optional()
});

export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    id: t.string(),
    attachments: t.array(t.string()),   // file names in blobs
    status: t.enum(['new', 'triaged', 'triage-failed']),
    triage: Triage.nullable()
});
```

```ts title="services.ts"
// Platform handlers validate input but don't apply Zod defaults: default in code.
handler('createTicket', Ticket, StoredTicket, async ({ attachments = [], ...ticket }, trigger) => {
    const { doc, mq, blob } = trigger.context;
    const id = randomUUID();

    // highlight-start
    for (const { name, content } of attachments) {
        await blob().container('attachments').file(`${id}/${name}`).upload(Readable.from([Buffer.from(content)]));
    }
    // highlight-end

    const stored: StoredTicket = { id, ...ticket, attachments: attachments.map((a) => a.name), status: 'new', triage: null };
    await doc().collection('tickets').by(id).set(stored);
    await mq().queue('ticket-created').send({ id });
    await trigger.ok(stored);
})
```

Triage and the assistant read them:

```ts title="triage.ts"
/** What triage needs of a ticket: its text, and the names of its attachments in blobs. */
export type TriageInput = { id: string; subject: string; body: string; attachments: string[] };

/** Adds the ticket's attachments to any chain. */
export function withAttachments<C extends { withBlob(container: string, path: string): C }>(chain: C, ticket: Pick<TriageInput, 'id' | 'attachments'>): C {
    return ticket.attachments.reduce((current, name) => current.withBlob('attachments', `${ticket.id}/${name}`), chain);
}
```

`triage(ticket)` now takes a `TriageInput`; a `StoredTicket` is one.

```ts
// in triage(): the extraction reads the attachments too
withAttachments(ai.extract('facts').schema(Facts).with(text), ticket).ask('Extract the facts of this ticket.')

// in assistant(): every turn sees them
const assistant = (ticket: StoredTicket) => withAttachments(
    Intelligence.conversations()
        .conversation(`ticket-${ticket.id}`)
        .prompt('support.chat', { shop: 'Velo' })
        .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage }),
    ticket
);
```

```yaml title="intelligence.yml"
blobs:
  - name: DEFAULT
    type: memory
```

## What the model gets

Text files (`.txt`, `.md`, `.csv`, `.json`, `.log`, …) are read and sent as text, one input per file, after the ticket. With a conversation and the entity store, each attachment of a turn is also recorded as an `AIConversationAttachment`.

:::caution Text only, for now
The bundled providers don't accept images or PDFs in chat or extraction yet. A photo of a broken part is stored, but not shown to the model. See [Known gaps](../guides/known-gaps.md#inputs).
:::

## Run it

```sh
yarn step:13
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Display error",
  "body": "My e-bike display shows an error, log attached.",
  "attachments": [{ "name": "display.log", "content": "08:12:01 ERR 503 motor sensor timeout\n08:12:01 ERR 503 motor sensor timeout" }]
}'
```

```json
{ "status": "triaged", "triage": { "summary": "E-bike display reports repeated error 503, a motor sensor timeout.", "department": "technical", … } }
```

## What you learned

- **Files go into `blobs`; model calls read them with `withBlob(container, path)`.**
- Text files are sent as text; the model sees them as additional input.
- A small helper keeps "add the attachments" in one place for every chain.

## Reviewer's view

> Ticket attachments are stored in `blobs/attachments/<ticket>/` and sent to the model during triage and chat.

Attachments are the least controlled input the desk has: anything a customer uploads reaches the model. That includes text crafted to steer it ("ignore your instructions…"). They're input, never instructions, and the tools the model has are read-only and scoped, so the worst case is a wrong answer, not a wrong action. Keep it that way.

[Sample: step 13](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/13-attachments) · Next: [Embeddings](./embeddings.md)
