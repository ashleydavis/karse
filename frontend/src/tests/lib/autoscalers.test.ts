import type { HorizontalPodAutoscaler } from "karse-types";
import {
    parseHpaTargets, metricPercent, metricLevel, formatHpaMetrics,
    replicaPercent, replicaLevel, formatReplicas,
} from "../../lib/autoscalers";

// Builds an HPA in the shape the backend returns, with per-test overrides.
function makeHpa(overrides: Partial<HorizontalPodAutoscaler> = {}): HorizontalPodAutoscaler {
    return {
        name: "web",
        namespace: "default",
        reference: "Deployment/web",
        minReplicas: 2,
        maxReplicas: 10,
        currentReplicas: 4,
        desiredReplicas: 4,
        targets: "cpu: 40%/80%",
        createdAt: "2024-06-01T00:00:00Z",
        labels: {},
        ...overrides,
    };
}

describe("parseHpaTargets", () => {
    test("parses a single resource metric", () => {
        expect(parseHpaTargets("cpu: 55%/80%")).toEqual([
            {
                name: "cpu",
                current: 55,
                target: 80,
            },
        ]);
    });

    test("parses several metrics", () => {
        expect(parseHpaTargets("memory: 60%/70%, cpu: 30%/80%")).toEqual([
            {
                name: "memory",
                current: 60,
                target: 70,
            },
            {
                name: "cpu",
                current: 30,
                target: 80,
            },
        ]);
    });

    test("reports a null current reading when the metric has not populated yet", () => {
        expect(parseHpaTargets("cpu: <unknown>/80%")).toEqual([
            {
                name: "cpu",
                current: null,
                target: 80,
            },
        ]);
    });

    test("reports a null target for a non-utilisation target", () => {
        expect(parseHpaTargets("packets-per-second: 10%/auto")).toEqual([
            {
                name: "packets-per-second",
                current: 10,
                target: null,
            },
        ]);
    });

    test("returns no metrics for an HPA with none", () => {
        expect(parseHpaTargets("<none>")).toEqual([]);
    });
});

describe("metricPercent", () => {
    test("reports the current reading as a percentage of the target", () => {
        expect(metricPercent({
            name: "cpu",
            current: 40,
            target: 80,
        })).toBe(50);
    });

    test("goes above 100 when the metric is over target", () => {
        expect(metricPercent({
            name: "cpu",
            current: 96,
            target: 80,
        })).toBe(120);
    });

    test("is null when the current reading is unknown", () => {
        expect(metricPercent({
            name: "cpu",
            current: null,
            target: 80,
        })).toBeNull();
    });

    test("is null when there is no metric at all", () => {
        expect(metricPercent(undefined)).toBeNull();
    });
});

describe("formatHpaMetrics", () => {
    test("formats each metric as name current/target", () => {
        expect(formatHpaMetrics(parseHpaTargets("cpu: 40%/80%"))).toBe("cpu 40%/80%");
    });

    test("joins several metrics with a comma", () => {
        expect(formatHpaMetrics(parseHpaTargets("memory: 60%/70%, cpu: 30%/80%")))
            .toBe("memory 60%/70%, cpu 30%/80%");
    });

    test("shows an em-dash for an unknown reading", () => {
        expect(formatHpaMetrics(parseHpaTargets("cpu: <unknown>/80%"))).toBe("cpu —/80%");
    });

    test("shows <none> when the HPA scales on no metrics", () => {
        expect(formatHpaMetrics([])).toBe("<none>");
    });
});

describe("metricLevel", () => {
    test("is ok with headroom below the target", () => {
        expect(metricLevel(50)).toBe("ok");
    });

    test("is warn as the metric approaches its target", () => {
        expect(metricLevel(85)).toBe("warn");
    });

    test("is critical at or above the target", () => {
        expect(metricLevel(120)).toBe("critical");
    });

    test("is info when the reading is unknown", () => {
        expect(metricLevel(null)).toBe("info");
    });
});

describe("replicaPercent", () => {
    test("reports current replicas as a percentage of maxReplicas", () => {
        expect(replicaPercent(makeHpa({
            currentReplicas: 4,
            maxReplicas: 10,
        }))).toBe(40);
    });

    test("is 100 when the HPA is scaled to its maximum", () => {
        expect(replicaPercent(makeHpa({
            currentReplicas: 10,
            maxReplicas: 10,
        }))).toBe(100);
    });

    test("is null when maxReplicas is not reported", () => {
        expect(replicaPercent(makeHpa({ maxReplicas: 0 }))).toBeNull();
    });
});

describe("formatReplicas", () => {
    test("shows current over desired replicas", () => {
        expect(formatReplicas(makeHpa({
            currentReplicas: 4,
            desiredReplicas: 6,
        }))).toBe("4/6");
    });
});

describe("replicaLevel", () => {
    test("is ok when current and desired agree within the bounds", () => {
        expect(replicaLevel(makeHpa({
            currentReplicas: 4,
            desiredReplicas: 4,
        }))).toBe("ok");
    });

    test("is warn while a scale-up is in flight", () => {
        expect(replicaLevel(makeHpa({
            currentReplicas: 4,
            desiredReplicas: 6,
        }))).toBe("warn");
    });

    test("is critical when the HPA is maxed out and cannot scale further", () => {
        expect(replicaLevel(makeHpa({
            currentReplicas: 10,
            desiredReplicas: 10,
            maxReplicas: 10,
        }))).toBe("critical");
    });
});
