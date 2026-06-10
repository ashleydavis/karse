import type { ClusterEvent } from "karse-types";
import { ALL_EVENT_TYPES, filterEventsByType } from "../../lib/event-type-filter";

// Builds a ClusterEvent fixture with the given reason and type; other fields are
// realistic but irrelevant to the type filter.
function makeEvent(reason: string, type: ClusterEvent["type"]): ClusterEvent {
    return {
        uid: `uid-${reason}`,
        type,
        reason,
        message: `${reason} happened`,
        count: 1,
        source: "kubelet",
        firstSeen: "2024-01-01T00:00:00Z",
        lastSeen: "2024-01-01T00:00:00Z",
        namespace: "default",
        objectKind: "Pod",
        objectName: "nginx",
    };
}

const EVENTS: ClusterEvent[] = [
    makeEvent("BackOff", "Warning"),
    makeEvent("Scheduled", "Normal"),
    makeEvent("Unhealthy", "Warning"),
    makeEvent("Pulled", "Normal"),
];

describe("ALL_EVENT_TYPES", () => {
    test("lists Warning then Normal", () => {
        expect(ALL_EVENT_TYPES).toEqual(["Warning", "Normal"]);
    });
});

describe("filterEventsByType", () => {
    test("an empty selection shows all events", () => {
        expect(filterEventsByType(EVENTS, [])).toEqual(EVENTS);
    });

    test("keeps only events whose type is selected", () => {
        const result = filterEventsByType(EVENTS, ["Warning"]);
        expect(result).toEqual([
            makeEvent("BackOff", "Warning"),
            makeEvent("Unhealthy", "Warning"),
        ]);
    });

    test("a multi-type selection keeps every matching event", () => {
        expect(filterEventsByType(EVENTS, ["Warning", "Normal"])).toEqual(EVENTS);
    });

    test("a selection matching no events yields an empty list", () => {
        const onlyNormal = [makeEvent("Scheduled", "Normal")];
        expect(filterEventsByType(onlyNormal, ["Warning"])).toEqual([]);
    });

    test("an empty event list stays empty regardless of selection", () => {
        expect(filterEventsByType([], ["Warning"])).toEqual([]);
        expect(filterEventsByType([], [])).toEqual([]);
    });
});
