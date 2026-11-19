---
title: Observability
---

# Observability

Two questions come up the first week an AI feature is in production: *"why did it answer that?"* and *"what does it cost?"*. Intelligence answers them in two ways: **traces** and **inference runs**.

## Traces

A tracer records every model call as a span: inputs, outputs, token usage, latency, and the nesting of calls. Tool calls appear inside the chat call that requested them.

### MLflow

Run a local MLflow server:

```sh
docker run -d --name mlflow -p 5001:5000 ghcr.io/mlflow/mlflow:latest \
  mlflow server --host 0.0.0.0 --port 5000 --backend-store-uri sqlite:////mlflow/mlruns/mlruns.db
```

Open `http://localhost:5001`, create an experiment and copy its id from the URL. Then:

```yaml
tracers:
  - name: DEFAULT
    enabled: true
    provider: mlflow
    parameters:
      trackingUri: ${{ MLFLOW_TRACKING_URI }}     # http://localhost:5001
      experimentId: ${{ MLFLOW_EXPERIMENT_ID }}
```

Only one tracer may be enabled at a time. See [`tracers`](../configuration/tracers.md).

### What you see

| Span | For |
|---|---|
| `chat` | `chat().answer()`, each round of the tool loop |
| `stream` | `chat().stream()` |
| `structured:<name>` | `extract(name)`, and decisions that fall back to structured output |
| `choice:<name>`, `score:<name>`, `noul:<name>` | Native decisions |
| `embed`, `rerank`, `transcribe`, `speech`, `image`, `moderation` | The other capabilities |

Tie spans to your domain with `.trace(traceId)`, `.labels(...)`, `.metadata({...})` and `.observabilityTag(tag)` on any chain.

## Inference runs

With the `IntelligenceTrace` domain registered, every model call is also stored as a record, in a domain kept apart from your business data:

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceTrace
```

| Entity | One per | Holds |
|---|---|---|
| `InferenceRun` | operation: a chat, a choice, a moderation | `kind`, `status`, `purpose`, `subjectType`, `subjectId`, `correlationId`, `durationMs`, `metadata` (with the prompts and their versions) |
| `ModelCall` | call to a provider, inside a run | `ai`, `provider`, `model`, `capability`, `inputTokens`, `outputTokens`, `totalTokens`, `durationMs`, `status` |
| `InferenceArtifact` | recorded input, output or error of a call | `kind`, `content`, `hash`, `sensitivity` |
| `ToolExecution` | tool the model called | the tool, its input and result, `status` |

`.metadata({ subjectType, subjectId, purpose })` on a chain fills the fields of the same name, so the records can be found by what they were made for:

```ts
import { IntelligenceTraceDomain } from '@3flows/intelligence';

const { InferenceRun, ModelCall } = IntelligenceTraceDomain;

const runs = await InferenceRun.find({ subjectType: 'ticket', subjectId: ticket.id }).limit(0).all();
const calls = await ModelCall.find({ run: runs[0].reference() }).limit(0).all();
```

Entity queries return ten records unless told otherwise: `limit(0)` reads them all.

Three things to know:

- **Recording never fails a call.** If a record can't be stored, the answer is still returned.
- **Artifacts contain what was sent and received**, so they can contain personal data. They need a retention rule: the tutorial deletes them with the record they were made for, in [Going live](../tutorial/going-live.md).
- **Chatbots and agents tag their own calls**: with `subjectType: 'chatbot-session'` and the session id, and with `subjectType: 'agent-run'` and the run id.

The tutorial uses these records in [See what it did](../tutorial/see-what-it-did.md).

## Metrics

The platform's `/metrics` endpoint exposes Prometheus metrics for the whole process, including one set per AI (label `model` is the AI's name from `ais`):

| Metric | |
|---|---|
| `intelligence_llm_requests_total` | Calls, except embeddings |
| `intelligence_llm_prompt_tokens_total`, `intelligence_llm_completion_tokens_total`, `intelligence_llm_tokens_total` | Tokens |
| `intelligence_llm_duration_seconds` | Latency histogram |
| `intelligence_embedding_requests_total`, `intelligence_embedding_tokens_total`, `intelligence_embedding_duration_seconds` | The same for `embedding()` |

Metrics are for dashboards and alerts (*"the triage AI's latency doubled"*); inference runs are for questions about single tickets.

## Personal data in traces

Traces contain the full inputs and outputs of calls: customer messages, extracted fields, tool results. Treat the tracing backend like a production database: access control, retention, and a place in your data protection documentation.
