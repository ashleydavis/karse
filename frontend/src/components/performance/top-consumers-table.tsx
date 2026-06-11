import { useState } from "react";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TableSortLabel, Typography,
} from "@mui/material";
import type { PodUsage, PerformanceMetric } from "karse-types";
import { useShareableNavigate } from "../../lib/nav-state";
import { tableRowSx } from "../../lib/table-row-style";
import { formatCpu, formatMemory, metricValue } from "../../lib/performance";

// A pod's usage for the selected metric is the table's value; nulls sort last so
// pods with no reading do not crowd the top of the ranking.
function sortValue(pod: PodUsage, metric: PerformanceMetric): number {
    const value = metricValue(pod.usage, metric);
    return value === null ? -1 : value;
}

// The selected metric's formatted usage for display, "—" when unavailable.
function formatUsage(pod: PodUsage, metric: PerformanceMetric): string {
    return metric === "cpu"
        ? formatCpu(pod.usage.cpuMillicores)
        : formatMemory(pod.usage.memoryBytes);
}

// A ranked, sortable table of pods by the selected metric's usage. Defaults to
// descending (the biggest consumers first); the Usage header toggles direction.
// Clicking a row opens that pod's detail page on its Performance tab, reusing the
// shared row-click navigation pattern.
export function TopConsumersTable({
    pods,
    metric,
}: {
    pods: PodUsage[];
    metric: PerformanceMetric;
}) {
    const navigate = useShareableNavigate();
    const [descending, setDescending] = useState(true);

    const ranked = [...pods].sort((a, b) => {
        const diff = sortValue(a, metric) - sortValue(b, metric);
        return descending ? -diff : diff;
    });

    return (
        <TableContainer data-test-id="perf-top-consumers">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Pod</TableCell>
                        <TableCell>Namespace</TableCell>
                        <TableCell>Node</TableCell>
                        <TableCell sortDirection={descending ? "desc" : "asc"}>
                            <TableSortLabel
                                active
                                direction={descending ? "desc" : "asc"}
                                onClick={() => setDescending((prev) => !prev)}
                                data-test-id="perf-top-consumers-usage-header"
                            >
                                Usage
                            </TableSortLabel>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {ranked.map((pod) => (
                        <TableRow
                            key={`${pod.namespace}/${pod.name}`}
                            data-test-id="perf-top-consumers-row"
                            sx={tableRowSx(true)}
                            onClick={() =>
                                navigate(`/pods/${pod.namespace}/${pod.name}`, { tab: "performance" })
                            }
                        >
                            <TableCell sx={{ fontFamily: "monospace" }}>{pod.name}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>{pod.namespace}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>{pod.node || "—"}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>{formatUsage(pod, metric)}</TableCell>
                        </TableRow>
                    ))}
                    {ranked.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4}>
                                <Typography color="text.secondary">No pods to rank.</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
