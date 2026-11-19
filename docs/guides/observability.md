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
| `chat` | `chat().ask(...)`, each round of the tool loop |
| `stream` | `chat().stream(...)` |
| `structured:<name>` | `extract(name)`, and decisions that fall back to structured output |
| `choice:<name>`, `score:<name>`, `noul:<name>` | Native decisions |
| `embed`, `rerank`, `transcribe`, `speech`, `image`, `moderation` | The other capabilities |

Tie spans to your domain with `.trace(traceId)`, `.labels(...)`, `.metadata({...})` and `.observabilityTag(tag)` on any chain.

## Inference runs

With the trace domain registered, model calls and tool executions can be stored as durable technical trace records:

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceTrace
```

Trace records capture fields such as operation, AI, provider, model, usage, latency, status, errors, prompts and chain metadata. Query them through the `IntelligenceTraceDomain` exports when your app needs technical accountability.

The `metadata` you set on chains links trace records back to business subjects, so questions like *"what did this ticket cost?"* are answered from trace/domain data rather than chatbot transcripts.

Recording is best-effort: if storing a trace fails, inference still returns its answer.

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
