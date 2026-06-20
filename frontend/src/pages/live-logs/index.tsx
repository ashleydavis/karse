import { Box, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStream } from "@fortawesome/free-solid-svg-icons";
import { LogViewer } from "../../components/log-viewer";

// The Logs page. It renders the shared LogViewer in full-picker mode: the user
// scopes a multi-pod live stream with a namespace selector and a searchable pod
// picker, then presses Stream. The same LogViewer backs the Pod detail Logs tab
// (pinned to that one pod), so both surfaces expose the same options. There is no
// "Tail" option and no Refresh button on either surface.
export function LiveLogsPage() {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FontAwesomeIcon icon={faStream} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Logs
                </Typography>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                <LogViewer testIdPrefix="live-logs" />
            </Box>
        </Box>
    );
}
