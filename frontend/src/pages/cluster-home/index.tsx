import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { ClusterOverview } from "./components/cluster-overview";
import { ClusterPerformanceTab } from "../../components/performance/cluster-performance-tab";

// The set of tabs available on the cluster home page.
type ClusterHomeTab = "overview" | "performance";

// Cluster home page, organizing its content into an Overview tab (the existing
// cluster overview) and a Performance tab (a stub for now).
export function ClusterHomePage() {
    const [activeTab, setActiveTab] = useState<ClusterHomeTab>("overview");

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="cluster-tabs"
                >
                    <Tab label="Overview" value="overview" data-test-id="cluster-tab-overview" />
                    <Tab label="Performance" value="performance" data-test-id="cluster-tab-performance" />
                </Tabs>
            </Box>

            {activeTab === "overview" && (
                <Box data-test-id="cluster-panel-overview">
                    <ClusterOverview />
                </Box>
            )}

            {activeTab === "performance" && (
                <Box data-test-id="cluster-panel-performance">
                    <ClusterPerformanceTab active={activeTab === "performance"} />
                </Box>
            )}
        </Box>
    );
}
