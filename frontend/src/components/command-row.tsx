import { useState } from "react";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";

// Copies a string to the clipboard, falling back gracefully when unavailable.
async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard)
    {
        await navigator.clipboard.writeText(text);
    }
}

// Renders one display-only kubectl command with a copy-to-clipboard button. The command
// text word-wraps so the full command is always visible without horizontal scroll.
// Shared by the resource detail Commands tab and the page help panel; Karse never runs
// the command, it only shows it for the user to copy.
export function CommandRow({ label, command }: { label: string; command: string }) {
    const [copied, setCopied] = useState(false);

    // Copies the command text and briefly shows a confirmation state.
    async function onCopy(): Promise<void> {
        await copyToClipboard(command);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }

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
                <Tooltip title={copied ? "Copied" : "Copy"}>
                    <IconButton
                        size="small"
                        onClick={onCopy}
                        aria-label={`copy ${label}`}
                        data-test-id="command-copy"
                    >
                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}
