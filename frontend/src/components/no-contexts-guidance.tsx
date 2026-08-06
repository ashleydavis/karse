import { Box, Typography } from "@mui/material";
import { addContextCommands, addContextHeading, addContextIntro } from "../lib/add-context-help";

// The empty-state guidance shown when the kubeconfig has no contexts at all. Rendered
// by the contexts table and by the multi-cluster overview page, so both dead ends show
// the same copy-ready commands instead of an empty table or a page of zeroes.
//
// Read-only invariant: the commands are text for the user to copy into their own
// terminal. Karse never runs them.
export function NoContextsGuidance() {
    return (
        <Box
            data-test-id="no-contexts-empty"
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}
        >
            <Typography color="text.secondary">
                {addContextHeading}
            </Typography>
            <Typography color="text.secondary" variant="body2">
                {addContextIntro}
            </Typography>
            {addContextCommands.map((cmd) => (
                <Box key={cmd.label} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {cmd.label}
                    </Typography>
                    <Box
                        component="code"
                        data-test-id="add-context-command"
                        sx={{
                            fontFamily: "monospace",
                            fontSize: "0.85rem",
                            bgcolor: "action.hover",
                            color: "text.primary",
                            px: 1,
                            py: 0.75,
                            borderRadius: 1,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                        }}
                    >
                        {cmd.command}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
