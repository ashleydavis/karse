import { Box, Typography } from "@mui/material";
import type { ClusterHealthSignals } from "karse-types";
import { HealthSignalCard } from "../../../components/resource-utilization/health-signal-card";

// Props for the cluster health-signals section: the health counters from the cluster
// performance snapshot, plus whether the Metrics API is available (carried so the section
// can degrade honestly if a future signal needs usage; the current signals all come from
// pod specs and node status and so populate regardless).
type ClusterHealthSignalsProps = {
    health: ClusterHealthSignals;
    metricsAvailable: boolean;
};

// The section heading, matching the other Overview sections' uppercase caption style.
function SectionHeading({ children }: { children: string }) {
    return (
        <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}
        >
            {children}
        </Typography>
    );
}

// Summarises the active node-pressure conditions as the tile's value text and decides
// whether the tile is highlighted. When no node reports any pressure the value reads
// "None" and the tile is calm; otherwise each pressure type with a non-zero count is
// listed (e.g. "Memory 2, Disk 1") and the tile is highlighted to draw attention.
function describeNodePressure(pressure: ClusterHealthSignals["nodePressure"]): {
    value: string;
    badgeLabel: string;
    level: "ok" | "warn";
    highlighted: boolean;
} {
    const parts: string[] = [];
    if (pressure.memoryPressure > 0) {
        parts.push(`Memory ${pressure.memoryPressure}`);
    }
    if (pressure.diskPressure > 0) {
        parts.push(`Disk ${pressure.diskPressure}`);
    }
    if (pressure.pidPressure > 0) {
        parts.push(`PID ${pressure.pidPressure}`);
    }
    if (parts.length === 0) {
        return { value: "None", badgeLabel: "OK", level: "ok", highlighted: false };
    }
    return { value: parts.join(", "), badgeLabel: "Pressure", level: "warn", highlighted: true };
}

// The cluster Overview health-signals row: five tiles derived from data already fetched
// with the performance snapshot (see docs/spec/resource-utilization). Pending pods and
// OOMKills surface problem counts; CPU throttling is permanently unavailable from kubectl
// (a fixed "—" / "N/A" tile that never invents a proxy); node count is informational; and
// node pressure highlights when any pressure condition is active.
export function ClusterHealthSignalsSection({ health }: ClusterHealthSignalsProps) {
    const pending = describeCount(health.pendingPods, "Pending pods");
    const oom = describeCount(health.oomKillCount, "OOMKills");
    const pressure = describeNodePressure(health.nodePressure);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <SectionHeading>Health signals</SectionHeading>
            <Box
                data-test-id="cluster-health-signals"
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
                    gap: 2,
                }}
            >
                <HealthSignalCard
                    title="Pending pods"
                    value={`${health.pendingPods}`}
                    badgeLabel={pending.badgeLabel}
                    level={pending.level}
                    testId="health-pending-pods"
                />
                <HealthSignalCard
                    title="OOMKills"
                    value={`${health.oomKillCount}`}
                    badgeLabel={oom.badgeLabel}
                    level={oom.level}
                    testId="health-oomkills"
                />
                <HealthSignalCard
                    title="CPU throttling"
                    value="—"
                    badgeLabel="N/A"
                    level="info"
                    testId="health-cpu-throttling"
                    caption="Not available from kubectl"
                />
                <HealthSignalCard
                    title="Node count"
                    value={`${health.nodeCount}`}
                    badgeLabel="Nodes"
                    level="info"
                    testId="health-node-count"
                />
                <HealthSignalCard
                    title="Node pressure"
                    value={pressure.value}
                    badgeLabel={pressure.badgeLabel}
                    level={pressure.level}
                    highlighted={pressure.highlighted}
                    testId="health-node-pressure"
                />
            </Box>
        </Box>
    );
}

// A non-negative count tile's badge: "OK" (neutral-good) when zero, "Active" (warn) when
// any are present, so a problem count reads at a glance.
function describeCount(count: number, _label: string): { badgeLabel: string; level: "ok" | "warn" } {
    if (count > 0) {
        return { badgeLabel: "Active", level: "warn" };
    }
    return { badgeLabel: "OK", level: "ok" };
}
