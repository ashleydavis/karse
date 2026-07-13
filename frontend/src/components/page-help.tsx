import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Alert, Box, Divider, Drawer, IconButton, Tooltip, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { buildPageHelp } from "../lib/page-help";
import { CommandRow } from "./command-row";

// Width of the help drawer. Wide enough that a long kubectl command wraps at most once.
const HELP_DRAWER_WIDTH = 480;

// Context-sensitive help for the current page, opened from a question-mark button in the
// header. It answers two questions for whatever page the user is on: where the page's data
// came from, and which read-only kubectl commands reproduce it. The commands are pinned to
// the selected context and namespace so they can be pasted straight into a terminal.
//
// Display-only: like the resource Commands tab, Karse never runs the commands it shows. The
// button hides itself on pages with no cluster data behind them (About, Config), so it stays
// unobtrusive, and the panel is closed until the user opens it.
export function PageHelp() {
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const { current } = useKubeContext();
    const { namespace } = useKubeNamespace();

    const help = buildPageHelp(pathname, {
        context: current,
        namespace,
    });
    if (help === null)
    {
        return null;
    }

    return (
        <>
            <Tooltip title="Where does this data come from?">
                <IconButton
                    size="small"
                    onClick={() => setOpen(true)}
                    aria-label="page help"
                    data-test-id="page-help-button"
                >
                    <FontAwesomeIcon icon={faCircleQuestion} />
                </IconButton>
            </Tooltip>
            <Drawer
                anchor="right"
                open={open}
                onClose={() => setOpen(false)}
                slotProps={{
                    paper: {
                        sx: {
                            width: HELP_DRAWER_WIDTH,
                            maxWidth: "100%",
                        },
                    },
                }}
            >
                <Box sx={{ p: 2 }} data-test-id="page-help-panel">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <Typography variant="h6" sx={{ flexGrow: 1 }} data-test-id="page-help-title">
                            {help.title}
                        </Typography>
                        <IconButton size="small" onClick={() => setOpen(false)} aria-label="close page help" data-test-id="page-help-close">
                            <FontAwesomeIcon icon={faXmark} />
                        </IconButton>
                    </Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Where this data comes from
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }} data-test-id="page-help-source">
                        {help.source}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Run it yourself
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }} data-test-id="page-help-readonly-note">
                        These are the read-only commands behind this page. Karse runs them through kubectl to build the view; copy them to run them yourself and get the same information.
                    </Alert>
                    {help.commands.map((c) => (
                        <CommandRow key={c.label} label={c.label} command={c.command} />
                    ))}
                </Box>
            </Drawer>
        </>
    );
}
