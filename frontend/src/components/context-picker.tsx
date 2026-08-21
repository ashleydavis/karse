import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    ClickAwayListener,
    Divider,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import type { Context } from "karse-types";
import { useConfig } from "../lib/config";
import { resolveEnvironment } from "../lib/cluster-environments";
import { contextPickerGroups } from "../lib/context-picker-rows";
import { EnvironmentChip } from "./environment-chip";

// The header's one and only context control: a trigger labelled with the active context's
// name that drops down a searchable, environment-grouped list of every context.
//
// `open` is owned by the header because the dropdown answers to Ctrl+K as well as a click,
// and the shortcut handler lives up there with the namespace picker's.
type Props = {
    contexts: Context[];
    current: string | null;
    onSwitch: (name: string) => void;
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
};

// Renders the context picker as a nav-bar dropdown anchored to its trigger button, using a
// MUI Tooltip so the dropdown gets a built-in arrow pointing at the button.
export function ContextPicker({ contexts, current, onSwitch, open, onOpen, onClose }: Props) {
    const { config: { contextEnvironments }, compiledEnvironments } = useConfig();
    const [query, setQuery] = useState("");

    // Every opening starts from the full list rather than resuming the last search, so the
    // shortcut always lands somewhere predictable.
    useEffect(() => {
        if (open) {
            setQuery("");
        }
    }, [open]);

    // The active context's environment, shown beside the trigger so it is obvious when the
    // current view is pointed at production, without opening anything. Resolved through the
    // same module the contexts page uses.
    const activeEnvironment = current === null ? null : resolveEnvironment(current, compiledEnvironments, contextEnvironments);

    // The matching contexts under one subheading per environment. Filtering runs before
    // grouping, so a search that hides every context in an environment hides that
    // environment's heading too, and no group at all means nothing matched.
    const groups = contextPickerGroups(contexts, query, compiledEnvironments, contextEnvironments);

    function handleSelect(name: string): void {
        if (name !== current) {
            onSwitch(name);
        }
        onClose();
    }

    // The picker content rendered inside the Tooltip surface.
    const content = (
        <ClickAwayListener onClickAway={onClose}>
            <Box data-test-id="context-picker-dropdown" sx={{ width: 360 }}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        placeholder="Search contexts..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                                ),
                            },
                        }}
                    />
                </Box>
                <Divider />
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {groups.length === 0 && (
                        <Typography sx={{ px: 2, py: 1 }} color="text.secondary" variant="body2">
                            No contexts match.
                        </Typography>
                    )}
                    <List dense disablePadding>
                        {groups.flatMap((group) => [
                            // The heading names its environment with the shared environment chip,
                            // the same component the top bar, the contexts table and the
                            // environment editor use, so one environment reads identically
                            // wherever it appears rather than as plain text here and a badge
                            // everywhere else. `inferred` is the presentation for a chip naming
                            // an environment itself rather than one context's resolution of it
                            // (the environment editor's rows do the same): filled versus outlined
                            // says a *context* was labelled by hand, which a heading covering a
                            // whole group cannot claim.
                            <ListSubheader
                                key={`group-${group.environment.id}`}
                                data-test-id="context-picker-group"
                                data-environment={group.environment.id}
                                sx={{ bgcolor: "background.paper", lineHeight: "unset", py: 1 }}
                            >
                                <EnvironmentChip
                                    environment={group.environment}
                                    source="inferred"
                                    testId="context-picker-group-chip"
                                />
                            </ListSubheader>,
                            ...group.items.map((ctx) => (
                                <ListItemButton
                                    key={ctx.name}
                                    selected={ctx.name === current}
                                    onClick={() => handleSelect(ctx.name)}
                                    data-test-id="context-picker-row"
                                    data-value={ctx.name}
                                >
                                    <ListItemText primary={ctx.name} secondary={ctx.cluster} />
                                    {ctx.name === current && (
                                        <Chip label="active" size="small" color="primary" sx={{ ml: 1 }} />
                                    )}
                                </ListItemButton>
                            )),
                        ])}
                    </List>
                </Box>
            </Box>
        </ClickAwayListener>
    );

    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
            {activeEnvironment !== null && (
                <EnvironmentChip
                    environment={activeEnvironment.environment}
                    source={activeEnvironment.source}
                    testId="header-environment-chip"
                />
            )}
            <Tooltip
                open={open}
                onClose={onClose}
                title={content}
                arrow
                placement="bottom-end"
                disableFocusListener
                disableHoverListener
                disableTouchListener
                slotProps={{
                    // No enter/exit animation so the dropdown is positioned and stable
                    // immediately, keeping clicks reliable.
                    transition: { timeout: 0 },
                    tooltip: {
                        sx: (theme) => ({
                            bgcolor: "background.paper",
                            color: "text.primary",
                            p: 0,
                            maxWidth: "none",
                            boxShadow: 3,
                            borderRadius: 1,
                            // A divider-coloured border so the panel edges stay visible in dark
                            // mode, where the panel shares the nav bar's background colour.
                            border: `1px solid ${theme.palette.divider}`,
                        }),
                    },
                    arrow: {
                        sx: (theme) => ({
                            color: "background.paper",
                            // A soft drop shadow on the arrow so its edges read against the
                            // page, plus a divider-coloured border on its two outer edges so the
                            // arrow stays visible in dark mode (matching the panel border).
                            "&::before": {
                                boxShadow: 1,
                                border: `1px solid ${theme.palette.divider}`,
                            },
                        }),
                    },
                }}
            >
                {/* The trigger is wrapped so the Tooltip's direct child never carries a `title`
                    of its own. MUI clones the child to manage its own title and logs
                    "You have provided a `title` prop to the child of <Tooltip />" on every
                    render when it already has one, which flooded the console. The wrapper keeps
                    the trigger's native hover hint (the keyboard shortcut) working. */}
                <span style={{ display: "inline-flex" }}>
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={onOpen}
                        aria-label="context picker"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        title="Context picker (Ctrl+K)"
                        data-test-id="context-picker-trigger"
                        endIcon={<FontAwesomeIcon icon={faChevronDown} size="xs" />}
                        sx={{ textTransform: "none" }}
                    >
                        {current ?? "no context"}
                    </Button>
                </span>
            </Tooltip>
        </Box>
    );
}
