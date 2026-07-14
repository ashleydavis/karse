# timestamp-format manual tests

Manual tests for the header's timestamp format toggle (age ⇄ local time). See the spec: [timestamp-format](../../spec/timestamp-format/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear the cluster down with the Teardown step at the end of this doc.

## Scenario: Switching every timestamp between age and local time

A cluster with nodes, pods, and a few events, so every kind of timestamp surface has something to show.

**Fixture:** [_fixtures-kwok/28-events-view](../_fixtures-kwok/28-events-view/)

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check

- **The toggle exists**: the top navbar shows a clock button between the namespace picker and the colour-mode button. Hover it: the tooltip reads "Timestamps: age. Click to show local time".
- **Age is the default**: navigate to `/nodes`. The **Age** column reads a relative age for each node (`0m`, `13m`, `2h`, `4d` — a number and a unit, never a date).
- **Switch to local time**: click the toggle. Its icon changes to a calendar, and its tooltip now reads "Timestamps: local time. Click to show age". Every **Age** cell in the nodes table now reads an absolute date and time in your own timezone, e.g. `14 Jul 2026, 09:23:45`.
- **Readable format**: the local time shows a short month name, a four-digit year, and a 24-hour clock **with seconds**. Check a node created moments ago and one created a while ago: both read as a full date and time, and the seconds distinguish two resources created within the same minute.
- **It applies to every surface** (with the toggle still in local-time mode):
  - `/pods`, `/deployments`, `/statefulsets`, `/daemonsets`, `/autoscalers`, `/all-resources`: the **Age** column reads a local date-time.
  - `/events`: the **Last seen** column reads a local date-time.
  - `/errors`: the **Age** column reads a local date-time.
  - Click into a pod, a node, a namespace, and a deployment: the **Age** stat on each detail page reads a local date-time. On the pod and node pages, the embedded **Events** table's **Last Seen** column does too, and on the node page so does the conditions table's **Last Transition** column.
  - Click an event row, then an error row: the **Age** field on each detail page reads a local date-time.
  - `/logs`: pick a pod, press **Stream**, and wait for a line. The caption beside the Stop button reads `Updated at 14 Jul 2026, 09:23:45` rather than `Updated 5s ago`.
- **First seen / Last seen are unchanged**: on the event and error detail pages, the **First seen** and **Last seen** fields always show the absolute local time with the age in parentheses (e.g. `14 Jul 2026, 09:23:45 (2h)`), in both modes. Only the **Age** field above them switches. This is intended: those fields exist to report the absolute time.
- **Sorting still works**: in local-time mode, click the nodes table's **Age** header. The rows sort by actual age (oldest/newest), not alphabetically by the rendered date string. Click again to reverse. The order matches what you get sorting the same column in age mode.
- **Errors search follows the display**: go to `/errors` in local-time mode and type the current year (e.g. `2026`) into the search box. Rows match on the displayed date. Switch back to age mode and search `h` or a value like `2h`: rows match on the displayed age instead.
- **Persists across navigation**: with local-time mode on, move between `/nodes`, `/events`, and a detail page. Every page stays in local-time mode; the toggle keeps its calendar icon.
- **Persists across a reload**: with local-time mode on, reload the browser (F5). The app comes back in local-time mode.
- **Switch back**: click the toggle again. The icon returns to the clock and every timestamp reads a relative age again.
- **Dark mode**: switch the colour mode to Dark and repeat a couple of the checks above. The toggle button and the timestamps are legible in both themes.
- **Unknown timestamps**: any timestamp the cluster did not report renders as `-` in both modes, never `NaN` or `Invalid Date`.

## Teardown

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/teardown.sh
```
