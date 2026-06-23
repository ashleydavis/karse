# logs-test-cluster manual test

Exercise Karse's log features against a realistic, continuously-changing workload
on a cluster you **already have**. You deploy a spread of log-emitting pods into
your existing cluster, confirm their logs are observable at the cluster level and
in Karse, then remove only those workloads.

> This scenario targets a cluster that **already exists and is reachable**. It
> does **not** create, prepare, or delete a cluster. The script applies workloads
> via your current `kubectl` context (or a context you name) and, on cleanup,
> deletes only the namespaces it created.

## What you need

- An existing, running, reachable Kubernetes cluster.
- `kubectl` on `PATH`, with its current context (or a context you pass with
  `--context`) pointed at that cluster. Confirm it is reachable:

  ```sh
  kubectl cluster-info
  ```

## What the script deploys

[`logs-test-workloads.sh`](./logs-test-workloads.sh) (it sits in this directory)
deploys **3 namespaces, 6 deployments, and 10 pods** with varied names and
`app` / `tier` / `env` labels. Every pod runs a small `busybox` loop that prints
one structured log line per second, each carrying randomised numbers
(`request_id`, `status`, `latency_ms`, `bytes`) and a mix of INFO / WARN / ERROR
levels — so reading a pod's logs twice a moment apart shows new lines with
different numbers.

| Namespace | Deployment | Replicas | app | tier | env |
|-----------|------------|----------|-----|------|-----|
| `web` | `api-gateway` | 2 | `api-gateway` | `frontend` | `prod` |
| `web` | `nginx-edge` | 1 | `nginx-edge` | `frontend` | `prod` |
| `payments` | `checkout-worker` | 3 | `checkout-worker` | `backend` | `prod` |
| `payments` | `ledger-api` | 1 | `ledger-api` | `backend` | `prod` |
| `infra` | `redis-cache` | 2 | `redis-cache` | `cache` | `staging` |
| `infra` | `log-shipper` | 1 | `log-shipper` | `backend` | `staging` |

The multi-replica deployments (`api-gateway`, `checkout-worker`, `redis-cache`)
give multiple pods per app so multi-pod aggregation and the Logs page
multi-select are all exercised. The varied namespaces and labels exercise the
pod-picker search and the "All namespaces" mode.

> The script's manifests use the standard Kubernetes `kind:` field (e.g.
> `kind: Deployment`). That is a manifest field, not a cluster tool — nothing in
> this scenario creates or prepares a cluster.

## Steps

### 1. Point kubectl at your existing cluster

Select the context for the cluster you want to test against (or rely on the
current one). The workloads land in whichever context you use; nothing else is
changed.

```sh
kubectl config use-context <your-context>
```

### 2. Deploy the workloads

From the repo root:

```sh
docs/testing-manual/logs-test-cluster/logs-test-workloads.sh deploy
```

Pass `--context <ctx>` to target a specific context without switching your
current one, e.g.
`docs/testing-manual/logs-test-cluster/logs-test-workloads.sh deploy --context my-cluster`.

The command applies the manifests, waits for the deployments to become available,
and prints the running pods with their labels. If no cluster is reachable it
errors and creates nothing.

Confirm the variety:

```sh
kubectl get pods -A -l app.kubernetes.io/managed-by=karse-logs-test -L app,tier,env
```

You should see 10 pods across the `web`, `payments`, and `infra` namespaces with
the labels from the table above.

### 3. Confirm continuous, changing logs at the cluster level

Read one pod's logs, wait a few seconds, and read again — the lines and their
random numbers change:

```sh
POD=$(kubectl -n payments get pods -l app=checkout-worker -o jsonpath='{.items[0].metadata.name}')
kubectl -n payments logs "$POD" --tail=3
sleep 3
kubectl -n payments logs "$POD" --tail=3
```

Follow a pod live:

```sh
kubectl -n payments logs "$POD" -f
```

Aggregate across all pods of one app:

```sh
kubectl -n payments logs -l app=checkout-worker --prefix --tail=3
```

The script automates all of the above:

```sh
docs/testing-manual/logs-test-cluster/logs-test-workloads.sh verify
```

It asserts the two reads differ, that follow streams lines, and that logs
aggregate across the `checkout-worker` pods.

### 4. Confirm the logs in Karse

Start Karse against the same cluster:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`.

**Logs page (`/logs`):**

1. Select the context for your cluster (top of the app), then open the Logs page.
2. Use the pod picker: search for `checkout` to disambiguate the similarly-named
   pods, and multi-select several pods across `web`, `payments`, and `infra`
   (try "All namespaces"). Confirm lines stream and the random numbers keep
   changing.
3. Pick a single pod and confirm its container log auto-loads and live-follows.

### 5. Clean up (workloads only)

Remove just the workloads this script created. The cluster is left intact — no
cluster is created or deleted at any point:

```sh
docs/testing-manual/logs-test-cluster/logs-test-workloads.sh cleanup
```

Cleanup deletes only namespaces that carry the script's
`app.kubernetes.io/managed-by=karse-logs-test` marker, so a pre-existing
namespace that happens to share a name (`web`, `payments`, `infra`) is never
touched. It is idempotent: re-running after the namespaces are gone is a no-op.

Confirm removal:

```sh
kubectl get pods -A -l app.kubernetes.io/managed-by=karse-logs-test
```

This should report no resources.

## Notes and limitations

- **No cluster lifecycle.** The script only ever applies, reads, and deletes
  workloads. It runs no cluster create/prepare/delete of any kind; you supply the
  cluster.
- **Re-running is safe.** `deploy` re-applies the same manifest (idempotent);
  `cleanup` only removes its own marker-labelled namespaces.
- **Real logs.** Because the workloads run on your real cluster's container
  runtime, the pod logs are genuinely real, so start Karse with `bun run dev`
  (not `dev:test`).
