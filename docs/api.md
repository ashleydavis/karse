# Karse HTTP API

All routes are served by the backend under `/api`, bound to `127.0.0.1` only. They are **local-only and unauthenticated**: there is no auth layer, because the only intended client is the same-machine browser. On a kubectl failure, a route responds `HTTP 500` with `{ "error": "<kubectl stderr>" }`. See `docs/security.md` for the security model and accepted risks.

During development the frontend reaches these routes through the Vite proxy at `http://localhost:5173/api/...`. The curl examples below talk to the backend directly at `http://127.0.0.1:5172`.

## Shared types

Canonical type definitions live in [packages/karse-types/src/index.ts](../packages/karse-types/src/index.ts). The key shapes are `Context`, `ContextsResponse`, `Node`, and `ClusterOverview`.

## GET /api/contexts

Lists every kubeconfig context plus the current one.

- **Request**: no body.
- **Response 200**: `ContextsResponse`.
- **Response 500**: `{ "error": "<kubectl stderr>" }` if listing contexts fails.

```sh
curl -fsS http://127.0.0.1:5172/api/contexts
```

```json
{
  "contexts": [
    { "name": "alpha", "cluster": "c1", "user": "u1", "namespace": "ns1" },
    { "name": "beta",  "cluster": "c2", "user": "u2", "namespace": null }
  ],
  "current": "alpha"
}
```

## POST /api/contexts/current

Switches the active kubeconfig context (`kubectl config use-context <name>`), then returns the refreshed contexts payload.

- **Request body**: `{ "name": string }`.
- **Response 200**: the refreshed `ContextsResponse` (with `current` updated).
- **Response 400**: `{ "error": "name must be a non-empty string" }` when `name` is missing, not a string, or empty/whitespace.
- **Response 400**: `{ "error": "name must not start with '-'" }` when `name` begins with `-`. A leading `-` would be parsed by `kubectl config use-context <name>` as a flag rather than a positional argument, so it is rejected at the HTTP boundary.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when kubectl rejects the name (e.g. no such context).

```sh
curl -fsS -X POST http://127.0.0.1:5172/api/contexts/current \
  -H 'Content-Type: application/json' \
  -d '{"name":"beta"}'
```

```json
{
  "contexts": [
    { "name": "alpha", "cluster": "c1", "user": "u1", "namespace": "ns1" },
    { "name": "beta",  "cluster": "c2", "user": "u2", "namespace": null }
  ],
  "current": "beta"
}
```

Validation errors:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:5172/api/contexts/current \
  -H 'Content-Type: application/json' -d '{"name":""}'      # 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:5172/api/contexts/current \
  -H 'Content-Type: application/json' -d '{"name":"-x"}'     # 400
```

## GET /api/cluster/overview

Returns the cluster overview for the current context.

- **Request**: no body.
- **Response 200**: `ClusterOverview`. `serverVersion` is `null` when the API server is unreachable (the context may exist in kubeconfig while the cluster is offline); the counts still reflect live queries.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when a node/namespace/pod count call fails.

```sh
curl -fsS http://127.0.0.1:5172/api/cluster/overview
```

```json
{
  "serverVersion": "v1.30.0",
  "nodeCount": 3,
  "namespaceCount": 4,
  "podCount": 15
}
```

## GET /api/cluster/nodes

Returns the nodes in the current context, shaped for the nodes table.

- **Request**: no body.
- **Response 200**: `{ "nodes": Node[] }`.
- **Response 500**: `{ "error": "<kubectl stderr>" }` when listing nodes fails.

```sh
curl -fsS http://127.0.0.1:5172/api/cluster/nodes
```

```json
{
  "nodes": [
    {
      "name": "ctrl-0",
      "status": "Ready",
      "roles": ["control-plane"],
      "version": "v1.30.0",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```
