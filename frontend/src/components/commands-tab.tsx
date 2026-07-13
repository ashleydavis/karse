import { useState } from "react";
import {
    Box,
    Typography,
    Alert,
    TextField,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { buildGuidedCommands, filterGuidedCommands, type GuidedResourceTarget } from "../lib/guided-commands";
import { CommandRow } from "./command-row";

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
