import { Box, useTheme } from "@mui/material";
import { ResponsiveHeatMap } from "@nivo/heatmap";
import type { HeatmapRow } from "../../lib/performance";

// Wraps nivo's ResponsiveHeatMap to render the Hot spots view: a row per node, a
// column per metric (cpu% / mem%), coloured by utilisation percentage. Clicking a
// cell calls onCellClick with the node name (the cell's serieId) so the caller can
// navigate to that node's detail page. Empty data renders a placeholder instead of an
// empty chart.
export function UsageHeatmap({
    data,
    onCellClick,
}: {
    data: HeatmapRow[];
    onCellClick: (nodeName: string) => void;
}) {
    const muiTheme = useTheme();
    // Axis text follows the MUI theme so the node names and column labels stay
    // readable in both light and dark mode.
    const chartTheme = {
        text: { fill: muiTheme.palette.text.primary },
        axis: {
            ticks: { text: { fill: muiTheme.palette.text.secondary } },
        },
    };

    if (data.length === 0) {
        return (
            <Box
                data-test-id="perf-heatmap-empty"
                sx={{ color: "text.secondary", py: 4, textAlign: "center" }}
            >
                No node utilisation to show.
            </Box>
        );
    }

    return (
        <Box data-test-id="perf-heatmap" sx={{ height: 80 + data.length * 44 }}>
            <ResponsiveHeatMap
                data={data}
                theme={chartTheme}
                margin={{ top: 40, right: 24, bottom: 24, left: 120 }}
                valueFormat={(value) => (value === null ? "—" : `${value}%`)}
                axisTop={{ tickSize: 5, tickPadding: 5 }}
                axisLeft={{ tickSize: 5, tickPadding: 5 }}
                colors={{
                    type: "sequential",
                    scheme: "yellow_orange_red",
                    minValue: 0,
                    maxValue: 100,
                }}
                emptyColor="#cbd5e1"
                borderWidth={1}
                borderColor="#ffffff"
                onClick={(cell) => onCellClick(cell.serieId)}
                hoverTarget="cell"
            />
        </Box>
    );
}
