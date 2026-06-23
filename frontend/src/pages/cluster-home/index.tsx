import { Box, Tabs, Tab } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { ClusterOverview } from "./components/cluster-overview";
import { ClusterPerformanceTab } from "../../components/performance/cluster-performance-tab";

// The set of tabs available on the cluster home page. The first tab's URL value stays
// "overview" (so existing shareable links keep working) and its label reads "Overview".
type ClusterHomeTab = "overview" | "performance";

// Reads the active tab from the URL, falling back to the Overview tab for any
// missing or unrecognized value. The tab lives in the URL so returning to this page
// from a drill-down (e.g. a treemap back-nav) can reopen the right tab.
function parseTab(value: string | null): ClusterHomeTab {
    if (value === "performance") {
        return value;
    }
    return "overview";
}

// Cluster home page, organizing its content into an Overview tab (the existing
// cluster overview) and a Performance tab.
export function ClusterHomePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseTab(searchParams.get("tab"));

    // Persists the active tab in the URL so a drill-down can return to it and the
    // view stays shareable.
    function setActiveTab(tab: ClusterHomeTab): void {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", tab);
            return next;
        }, { replace: true });
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value) => setActiveTab(value)}
                    data-test-id="cluster-tabs"
                >
                    <Tab label="Overview" value="overview" data-test-id="cluster-tab-overview" />
                    <Tab label="Resource utilization" value="performance" data-test-id="cluster-tab-performance" />
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
