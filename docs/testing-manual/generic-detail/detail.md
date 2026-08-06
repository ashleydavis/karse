# generic-detail manual tests

Manual tests for the generic detail page. See the spec: [generic-detail](../../spec/generic-detail/detail.md).

Karse has purpose-built detail pages for six kinds (Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet). Every other readable kind gets the generic detail page at `/resources/:type/:name` (cluster-scoped) or `/resources/:type/:namespace/:name` (namespaced), which shows the metadata every Kubernetes object carries plus that resource's labels and raw YAML.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear the cluster down with the Teardown step at the end of this doc.

## Scenario: Resources with no detail page of their own

A cluster holding kinds Karse has no specific page for: the namespaced `shop-hpa` (HorizontalPodAutoscaler), `shop-svc` (Service) and `nightly-backup` (Job) in `default`, plus the cluster-scoped `archive-pv` (PersistentVolume). A 0-replica `shop` deployment is present as the autoscaler's target; nothing in the fixture creates a pod.

**Fixture:** [_fixtures-kwok/38-generic-detail](../_fixtures-kwok/38-generic-detail/)

```sh
./docs/testing-manual/_fixtures-kwok/38-generic-detail/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Reaching the page from the All resources list

- Navigate to `/all-resources`.
- Find the `shop-hpa` row. Its Kind cell reads `HorizontalPodAutoscaler`. The row is clickable: hovering shows the same pointer/highlight affordance as every other clickable row.
- Click the row. Karse navigates to `/resources/horizontalpodautoscalers/default/shop-hpa`. Before this feature the click did nothing at all.
- The breadcrumb reads `All resources > shop-hpa`. Click the `All resources` crumb: it returns to the list.

### The Details tab

- On the `shop-hpa` page, the header shows the name `shop-hpa`, a copy control beside it, and a chip reading `HorizontalPodAutoscaler`.
- The Details tab shows three fields: **Namespace** (`default`, rendered as a link), **Kind** (`HorizontalPodAutoscaler`), and **Age**.
- Click the **Namespace** link. It opens `/namespaces/default`. Go back to the HPA page.
- Toggle the timestamp format in the header (the age / local-time toggle). The **Age** field switches between a relative age and an absolute local time, like every other timestamp in the app.
- Below the Details card, an **Annotations** card lists the resource's annotations as a Key / Value table. `karse.test/purpose` is one of the rows.
- Open `/resources/persistentvolumes/archive-pv` and confirm its Annotations card reads "This resource has no annotations." (the fixture sets none on the volume).

### The Labels tab

- Back on `shop-hpa`, click the **Labels** tab. It shows a searchable, sortable Key / Value table with that resource's own labels: `app` / `shop` and `tier` / `web`.
- Type `tier` into the search box: only that row remains. Clear it and both rows return.

### The YAML tab

- Click the **YAML** tab. The panel shows the resource's raw YAML, starting with `apiVersion: autoscaling/v2` and containing `kind: HorizontalPodAutoscaler` and `name: shop-hpa`.
- The copy button at the top-right of the YAML panel copies the YAML and briefly flips to a check mark.

### The back button

- Click the back arrow beside the page title. It returns to `/all-resources`, because a resource with no page of its own has no per-kind list page to go back to.

### A cluster-scoped kind (no namespace segment)

- Open `/resources/persistentvolumes/archive-pv` directly in the address bar.
- The page shows the name `archive-pv` and the chip `PersistentVolume`.
- The Details card shows **Kind** and **Age** but **no Namespace field**: the resource is cluster-scoped, and its route carries no namespace segment.
- The **Labels** tab shows `tier` / `storage`. The **YAML** tab shows `kind: PersistentVolume` and the `5Gi` capacity.

### Other generic kinds

- Open `/resources/services/default/shop-svc`. The page shows the Service's name, namespace, age, labels and YAML.
- Open `/resources/jobs/default/nightly-backup`. The page shows the Job the same way.

### Precedence: a kind with its own page never uses the generic one

- On `/all-resources`, click a `Namespace` row (e.g. `default`). It opens `/namespaces/default`, the purpose-built namespace page, **not** `/resources/namespaces/default`.
- Do the same with the `shop` Deployment row: it opens `/deployments/default/shop`, the workload detail page.
- Type `/resources/deployments/default/shop` into the address bar by hand. The generic page will render it (nothing forbids the URL), but nothing in the app ever links there: every link and row for those six kinds goes to their own page.

### Not found

- Open `/resources/horizontalpodautoscalers/default/no-such-hpa`.
- The page shows a clear **Not found** notice naming the kind, the name and the namespace, rather than a blank page, an endless spinner, or a crash. There is no Retry button: retrying cannot make the resource exist.

### A kind Karse will not read

- Open `/resources/secrets/default/db-password`.
- The page shows an **Unsupported resource type** message naming `secrets`. Karse deliberately refuses to read secrets, and no request is sent to the cluster.
- Open `/resources/notathing/default/whatever`. The same message appears, naming `notathing`.

### Light and dark mode

- Toggle the theme in the header and repeat the Details, Labels and YAML tabs plus the not-found state. Every card, table and message stays legible in both modes.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/38-generic-detail/teardown.sh
```
