# Karse FAQ

## 1. What is Karse and what can it do?

Karse is a local-only, read-only dashboard for your Kubernetes clusters. It shows a cluster overview (server version, node count, namespace count, pod count) and a nodes table for whichever kubeconfig context you have selected. It never modifies cluster state.

## 2. Is Karse safe to run against a production cluster?

Yes. Karse only issues read-only kubectl commands. No mutating commands are ever issued.

## 3. Will Karse change anything in my cluster?

No. Karse never creates, edits, or deletes any cluster resource.

## 4. Will Karse read any files from my computer?

Karse itself does not open any files. It shells out to `kubectl`, which reads your `~/.kube/config` as it normally would. Karse never sees the raw file, your credentials, or your certificates.

## 5. Will Karse change anything on my computer?

Only two things: it appends to its own audit log under `logs/` in the repo directory, and switching contexts updates the `current-context` field in `~/.kube/config` via `kubectl config use-context` (the same as running that command yourself).

Karse will not change anything else on your computer.

## 6. Does Karse write anything to my computer?

Only the audit log at `logs/<YYYY>/<MM>/<DD>/<HH>.log` under the repo root. It logs the timestamp and kubectl command for every call it makes. No credentials or response data are ever logged.

## 7. Does Karse ever send data to the internet?

No. The backend binds to `127.0.0.1` and makes no outbound connections of its own. The only external communication is between `kubectl` and your cluster's API server, the same as running `kubectl` in a terminal.

## 8. How do I switch between clusters?

Use the context picker in the page header. Karse will switch to that context and immediately refresh all data. You can also run `kubectl config use-context <name>` in your terminal and then reload Karse.

## 9. Will switching contexts in Karse affect my terminal's `kubectl` context?

Yes. Karse runs `kubectl config use-context` under the hood, which updates `~/.kube/config`. Your terminal will see the same active context.

## 10. How do I check what commands Karse has executed?

A rolling text file at `logs/<YYYY>/<MM>/<DD>/<HH>.log` under the repo root. One line is written per kubectl call, containing the timestamp and the exact command. See [docs/audit-log.md](audit-log.md) for the full format.

## 11. How long are audit logs kept?

Three months. Older log files are pruned automatically each time the backend starts. You can also delete log files manually at any time.

## 12. Can another machine on my network reach Karse?

No. The backend binds to `127.0.0.1` (loopback only). Connections from any other machine are refused at the OS level.

## 13. Does Karse store my kubeconfig credentials?

No. Karse never opens, parses, or caches `~/.kube/config`. Credentials are read by `kubectl` itself and are never seen or logged by Karse.

## 14. Is the HTTP API authenticated?

No. It is intentionally unauthenticated because it binds to loopback only and the only intended client is the browser on the same machine. If you share a machine with other local users, they can also reach it on `127.0.0.1`.
