import { useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Tooltip,
    Box,
    Typography,
    Alert,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buildGuidedCommands, type GuidedResourceTarget } from "../lib/guided-commands";

// Copies a string to the clipboard, falling back gracefully when unavailable.
async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard)
    {
        await navigator.clipboard.writeText(text);
    }
}

// Renders one suggested command row with a copy-to-clipboard button.
function CommandRow({ label, command }: { label: string; command: string }) {
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                        overflowX: "auto",
                        whiteSpace: "nowrap",
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
                        <FontAwesomeIcon icon={["fas", copied ? "check" : "copy"]} />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}

// Dialog listing display-only kubectl command suggestions for a resource.
// These commands are never executed by Karse; the user copies and runs them.
export function CommandsDialog({ open, onClose, target }: {
    open: boolean;
    onClose: () => void;
    target: GuidedResourceTarget;
}) {
    const commands = buildGuidedCommands(target);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-test-id="commands-dialog">
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FontAwesomeIcon icon={["fas", "terminal"]} />
                Commands for {target.name}
            </DialogTitle>
            <DialogContent>
                <Alert severity="info" sx={{ mb: 2 }} data-test-id="commands-readonly-note">
                    Karse is read-only and never runs these commands. Copy and run them yourself.
                </Alert>
                {commands.map((c) => (
                    <CommandRow key={c.label} label={c.label} command={c.command} />
                ))}
            </DialogContent>
        </Dialog>
    );
}
