import { useState } from "react";
import {
    Box,
    Typography,
    Alert,
    IconButton,
    Tooltip,
    TextField,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { buildGuidedCommands, filterGuidedCommands, type GuidedResourceTarget } from "../lib/guided-commands";

// Copies a string to the clipboard, falling back gracefully when unavailable.
async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard)
    {
        await navigator.clipboard.writeText(text);
    }
}

// Renders one suggested command row with a copy-to-clipboard button. The command
// text word-wraps so the full command is always visible without horizontal scroll.
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

// Detail-page tab listing display-only kubectl command suggestions for a resource.
// These commands are never executed by Karse; the user copies and runs them. The
// list is searchable and uses the full detail-page width, with word-wrapped commands.
export function CommandsTab({ target }: { target: GuidedResourceTarget }) {
    const [query, setQuery] = useState("");
    const commands = buildGuidedCommands(target);
    const visible = filterGuidedCommands(commands, query);

    return (
        <Box data-test-id="commands-tab">
            <Alert severity="info" sx={{ mb: 2 }} data-test-id="commands-readonly-note">
                Karse is read-only and never runs these commands. Copy and run them yourself.
            </Alert>
            <TextField
                size="small"
                fullWidth
                placeholder="Search commands"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-test-id="commands-search"
                sx={{ mb: 2 }}
                slotProps={{
                    input: {
                        startAdornment: <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />,
                    },
                }}
            />
            {visible.length === 0
                ? (
                    <Typography color="text.secondary" data-test-id="commands-empty">
                        No commands match your search.
                    </Typography>
                )
                : (
                    visible.map((c) => (
                        <CommandRow key={c.label} label={c.label} command={c.command} />
                    ))
                )
            }
        </Box>
    );
}
