---
title: tracers
---

# `tracers`

Where traces of model calls go. Guide: [Observability](../guides/observability.md).

```yaml
tracers:
  - name: DEFAULT
    enabled: true
    provider: mlflow
    parameters:
      trackingUri: ${{ MLFLOW_TRACKING_URI }}
      experimentId: ${{ MLFLOW_EXPERIMENT_ID }}
```

## Fields

| Field | Required | Description |
|---|---:|---|
| `name` | no | Defaults to `DEFAULT` |
| `enabled` | yes | Only one tracer may be enabled |
| `provider` | no | `mlflow` (default), or a class registered as `@Register('x', 'tracer')` |
| `parameters` | no | Provider settings |

## MLflow parameters

| Field | Default | Description |
|---|---|---|
| `trackingUri` | `http://localhost:5000` | MLflow server |
| `experimentId` | `0` | Experiment to log into |
| `trackingServerToken` | | Bearer token |
| `trackingServerUsername`, `trackingServerPassword` | | Basic authentication |

Without an enabled tracer, spans are not recorded, and calls run without tracing overhead.
