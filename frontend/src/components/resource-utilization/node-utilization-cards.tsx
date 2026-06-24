import { Box } from "@mui/material";
import type { NodeUsage } from "karse-types";
import { useResourceUtilization } from "../../lib/resource-utilization-context";
import { nodeMetricFigure } from "../../lib/resource-utilization";
import { MetricCard } from "./metric-card";

// Props for the node-detail utilization cards: the one node's usage/requests/allocatable
// (from the node Performance snapshot) and whether the Performance tab is active. `active`
// is accepted to match the lazy-friendly component contract (the parent only renders this
// once its query has resolved); the cards themselves read the shared toggle context, so
// they have no fetch of their own.
type NodeUtilizationCardsProps = {
    node: NodeUsage;
    active: boolean;
};

// The node-detail utilization cards: two MetricCards (CPU and Memory) showing the node's
// consumption against its allocatable capacity, matching the prototype node-detail.html
// resource cards. Both cards read the shared View-mode (usage/requests) and Value-format
// (percent/absolute) toggles via the resource-utilization context, so the page's
// ViewToggles drive them together. Each card's bar fills to the metric's percentage of
// allocatable; the value text is the rounded "%" or the "used / total" absolute pair per
// the format toggle. The sublabel names the base so the figure reads unambiguously.
export function NodeUtilizationCards({ node, active }: NodeUtilizationCardsProps) {
    const { mode, format } = useResourceUtilization();
    void active;

    const cpu = nodeMetricFigure(node.usage, node.requests, node.allocatable, "cpu", mode, format);
    const memory = nodeMetricFigure(node.usage, node.requests, node.allocatable, "memory", mode, format);

    const sublabel = mode === "usage" ? "of node allocatable (usage)" : "of node allocatable (requests)";

    return (
        <Box
            data-test-id="node-utilization-cards"
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
            }}
        >
            <MetricCard
                label="CPU"
                valueText={cpu.valueText}
                sublabel={sublabel}
                percent={cpu.percent}
                level={cpu.level}
                testId="node-util-card-cpu"
            />
            <MetricCard
                label="Memory"
                valueText={memory.valueText}
                sublabel={sublabel}
                percent={memory.percent}
                level={memory.level}
                testId="node-util-card-memory"
            />
        </Box>
    );
}
