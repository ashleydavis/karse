import type { HorizontalPodAutoscaler } from "karse-types";
import type { ThresholdLevel } from "./resource-utilization";

// One metric an HPA scales on, taken from the backend's `targets` summary string
// (the same text kubectl prints in its TARGETS column). `current` is the metric's
// latest reading and `target` the utilisation the HPA is steering towards, both as
// percentages; either is null when the cluster has not reported it (a freshly
// created HPA, no Metrics API, or a non-utilisation target kubectl prints as "auto").
export type HpaMetric = {
    name: string;
    current: number | null;
    target: number | null;
};

// Parses a percentage token from the targets summary ("55%" → 55). Returns null for
// the placeholders the backend emits when a value is unavailable ("<unknown>", "auto").
function parsePercent(token: string): number | null {
    const match = token.trim().match(/^(\d+(?:\.\d+)?)%$/);
    if (match === null) {
        return null;
    }
    return Number(match[1]);
}

// Parses the backend's `targets` summary into one HpaMetric per metric the HPA scales
// on. Handles the single-metric case ("cpu: 55%/80%"), the multi-metric case
// ("memory: 60%/70%, cpu: 30%/80%"), the not-yet-reported case ("cpu: <unknown>/80%"),
// and the no-metrics case ("<none>", which yields an empty list).
export function parseHpaTargets(targets: string): HpaMetric[] {
    const text = targets.trim();
    if (text === "" || text === "<none>") {
        return [];
    }
    const metrics: HpaMetric[] = [];
    for (const part of text.split(",")) {
        const match = part.trim().match(/^([^:]+):\s*(\S+)\/(\S+)$/);
        if (match === null) {
            continue;
        }
        metrics.push({
            name: match[1]!.trim(),
            current: parsePercent(match[2]!),
            target: parsePercent(match[3]!),
        });
    }
    return metrics;
}

// How close a metric is to the target the HPA steers it to, as a percentage of that
// target (100% = exactly on target, above = the HPA scales up, below = it scales down).
// Null when either side is unknown, so the bar renders empty rather than a fabricated 0.
export function metricPercent(metric: HpaMetric | undefined): number | null {
    if (metric === undefined || metric.current === null || metric.target === null || metric.target === 0) {
        return null;
    }
    return (metric.current / metric.target) * 100;
}

// The metric summary shown beside the Targets bar: "cpu 55%/80%" per metric, joined by
// a comma when the HPA scales on several. An unknown side reads "—". No metrics yields
// "<none>", matching kubectl's own placeholder.
export function formatHpaMetrics(metrics: HpaMetric[]): string {
    if (metrics.length === 0) {
        return "<none>";
    }
    const parts: string[] = [];
    for (const metric of metrics) {
        const current = metric.current === null ? "—" : `${metric.current}%`;
        const target = metric.target === null ? "—" : `${metric.target}%`;
        parts.push(`${metric.name} ${current}/${target}`);
    }
    return parts.join(", ");
}

// Classifies a metric's distance from its target: at or above target the HPA is scaling
// up (critical), close to it it is about to (warn), otherwise it has headroom (ok). An
// unknown reading is info (nothing to grade).
export function metricLevel(percent: number | null): ThresholdLevel {
    if (percent === null) {
        return "info";
    }
    if (percent >= 100) {
        return "critical";
    }
    if (percent >= 80) {
        return "warn";
    }
    return "ok";
}

// How much of its maximum scale the HPA is currently using (current replicas as a
// percentage of maxReplicas), so a nearly-maxed-out autoscaler is visible at a glance.
// Null when maxReplicas is not reported, so the bar renders empty.
export function replicaPercent(hpa: HorizontalPodAutoscaler): number | null {
    if (hpa.maxReplicas <= 0) {
        return null;
    }
    return (hpa.currentReplicas / hpa.maxReplicas) * 100;
}

// The replica summary shown beside the Replicas bar: current replicas over the replica
// count the HPA is driving the target towards ("4/6" while a scale-up is in flight,
// "4/4" once settled).
export function formatReplicas(hpa: HorizontalPodAutoscaler): string {
    return `${hpa.currentReplicas}/${hpa.desiredReplicas}`;
}

// Classifies an HPA's scale: maxed out (critical, it cannot scale up any further),
// mid-scale with current and desired disagreeing (warn, a scale-up or scale-down is in
// flight), or settled within its bounds (ok).
export function replicaLevel(hpa: HorizontalPodAutoscaler): ThresholdLevel {
    if (hpa.maxReplicas > 0 && hpa.currentReplicas >= hpa.maxReplicas) {
        return "critical";
    }
    if (hpa.currentReplicas !== hpa.desiredReplicas) {
        return "warn";
    }
    return "ok";
}
