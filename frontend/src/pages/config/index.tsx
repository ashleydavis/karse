import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { CacheSettings } from "./components/cache-settings";
import { EnvironmentsSettings } from "./components/environments-settings";

// Config page: the app's settings, one subtab per group of them. The cluster-data cache
// settings are the first tab (and the landing tab, so the page opens where it always did);
// the user's environment list is the second.
export function ConfigPage() {
    const [tab, setTab] = useState("cache");

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Tabs
                value={tab}
                onChange={(_, next) => setTab(next)}
                data-test-id="config-tabs"
            >
                <Tab label="Cluster data cache" value="cache" data-test-id="config-tab-cache" />
                <Tab label="Environments" value="environments" data-test-id="config-tab-environments" />
            </Tabs>
            {tab === "cache" && <CacheSettings />}
            {tab === "environments" && <EnvironmentsSettings />}
        </Box>
    );
}
