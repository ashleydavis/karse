import { Box, Typography } from "@mui/material";
import { CopyButton } from "./copy-button";

// Renders one display-only kubectl command with a copy-to-clipboard button. The command
// text word-wraps so the full command is always visible without horizontal scroll.
// Shared by the resource detail Commands tab and the page help panel; Karse never runs
// the command, it only shows it for the user to copy.
export function CommandRow({ label, command }: { label: string; command: string }) {
    return (
        <Box data-test-id="command-row" sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box
                    component="code"
                    data-test-id="command-text"
                    sx={{
                        flexGrow: 1,
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        bgcolor: "grey.900",
                        color: "grey.100",
                        px: 1,
                        py: 0.75,
                        borderRadius: 1,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                    }}
                >
                    {command}
                </Box>
                <CopyButton text={command} label={label} testId="command-copy" />
            </Box>
        </Box>
    );
}
