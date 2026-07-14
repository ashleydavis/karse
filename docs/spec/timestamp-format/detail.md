# timestamp-format

## Overview

Every timestamp Karse shows (a resource's age, an event's last-seen, an error's age, a node condition's last transition, the log stream's last-updated caption) is rendered in one of two formats, chosen app-wide by a single toggle in the header:

- **age** — the relative time since the timestamp, in the largest non-zero unit: `2d`, `4h`, `37m`, flooring at `0m`. This is the default, and matches how `kubectl get` reports age.
- **local** — the absolute time in the viewer's own timezone and locale: `14 Jul 2026, 09:23:45`.

Backed by: `frontend/src/lib/timestamps.ts` (the formatters), `frontend/src/lib/use-timestamp-format.ts` (the hook that binds them to the chosen mode), `frontend/src/components/timestamp.tsx` (the `<Timestamp>` component every surface renders through), `frontend/src/lib/config.tsx` (the persisted setting), `frontend/src/components/header.tsx` (the toggle).

This is a frontend-only concern. The backend returns raw ISO timestamps and is unchanged; the choice is never sent to it.

## Behaviour

- The header carries a **timestamp format** toggle (`aria-label="timestamp format"`) beside the colour-mode control. Its icon reports the mode in force (a clock in age mode, a calendar in local-time mode) and its tooltip names the mode a click would switch to. There are only two modes, so one button flips between them.
- Switching the mode re-renders every timestamp in the app at once: the setting lives in the `ConfigProvider` context, and every timestamp surface reads it through `<Timestamp>`.
- The mode is **persisted** in `localStorage` under the existing `karse-config` key (alongside the colour mode), so it survives navigation *and* a page reload, and a new tab opens in the last-chosen mode. The default is **age**, so a first-time view is unchanged from before this feature.
- **Local time is formatted for readability**, identically everywhere: a short month name (so the day/month order is never ambiguous), a four-digit year, and a 24-hour clock with seconds (so a timestamp seconds old is still distinguishable from one a minute old). The browser's own locale and timezone are used — `14 Jul 2026, 09:23:45` in `en-GB`, `Jul 14, 2026, 09:23:45` in `en-US`.
- A timestamp the cluster did not report (an empty or unparseable value) renders as `-` in both modes, never as `NaN` or `Invalid Date`.
- **Sorting is unaffected.** Every table's age/last-seen column sorts on the raw timestamp behind the cell, so the sort order is the same in both modes.
- **Searching follows the display.** The errors table's search matches the text the table actually shows, so in age mode `2h` matches and in local-time mode `2026` matches (`frontend/src/lib/errors-search.ts`).

### Surfaces the toggle governs

| Surface | Timestamp |
|---|---|
| Nodes, Pods, Deployments, Stateful sets, Daemon sets, Autoscalers, All resources tables | `Age` column |
| Events table | `Last seen` column |
| Errors table | `Age` column |
| Pod, Workload, Node, Namespace detail pages | `Age` stat |
| Pod, Workload, Node detail pages | the events table's `Last Seen` column |
| Node detail page | the conditions table's `Last Transition` column |
| Event detail page | `Age` field |
| Error detail page | `Age` field |
| Log viewer (Logs page and the Pod detail Logs tab) | the `Updated ...` caption: `Updated 5s ago` in age mode, `Updated at 14 Jul 2026, 09:23:45` in local-time mode |

### What the toggle deliberately does not change

- The **First seen** and **Last seen** fields on the event and error detail pages. These exist to report the absolute time and always show it, with the age appended in parentheses (`14 Jul 2026, 09:23:45 (2h)`). There is nothing for the toggle to reveal there, so switching modes does not change them. They do use the same readable local-time format as everything else.
- **Column headers.** The `Age` / `Last seen` headers name the underlying field, not the format it is rendered in, so they read the same in both modes.

## Acceptance Criteria

- [x] A single header toggle switches timestamp display between age and local time.
- [x] The setting applies to every timestamped surface: resource tables, resource detail pages, events, errors, node conditions, and the log viewer's last-updated caption.
- [x] Local time is human-readable (short month, four-digit year, 24-hour clock with seconds, viewer's timezone) and formatted identically across the app.
- [x] The chosen mode persists across navigation and across a page reload (`localStorage`, `karse-config`).
- [x] The default mode is age, so the default view is unchanged.
- [x] An absent or unparseable timestamp renders as `-` in both modes.
- [x] Table sorting is unaffected by the mode; the errors search matches whichever text is displayed.

## Open Questions

None.
