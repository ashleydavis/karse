import type { ClusterEvent } from "karse-types";

// Every selectable event type, in display order. Drives the type-filter dropdown
// on the events page.
export const ALL_EVENT_TYPES: ClusterEvent["type"][] = ["Warning", "Normal"];

// Narrows a list of events to those whose type is checked in the filter. The
// events page defaults to showing everything: an empty selection means "no type
// restriction", so every event passes. A non-empty selection keeps only events
// whose type is in the set. Search and sorting are applied separately.
export function filterEventsByType(events: ClusterEvent[], selected: string[]): ClusterEvent[] {
    if (selected.length === 0) {
        return events;
    }
    return events.filter((event) => selected.includes(event.type));
}
