import { Box } from "@mui/material";
import { LogViewer } from "../../components/log-viewer";

// The Logs page. It renders the shared LogViewer in full-picker mode: the user
// scopes a multi-pod live stream with a namespace selector and a searchable pod
// picker, then presses Stream. The same LogViewer backs the Pod detail Logs tab
// (pinned to that one pod), so both surfaces expose the same options. There is no
// "Tail" option and no Refresh button on either surface.
//
// The page title ("Logs") is shown once, in the navbar breadcrumb; the page does
// not repeat it as an in-page heading.
export function LiveLogsPage() {
    return (
        <Box sx={{ display: "flex", height: "100%", minHeight: 0 }}>
            <LogViewer testIdPrefix="live-logs" />
        </Box>
    );
}
