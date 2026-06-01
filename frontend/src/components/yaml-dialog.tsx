import { useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Button,
    IconButton,
    Tooltip,
    Alert,
    Paper,
    Typography,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCode, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { YamlResourceType } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchResourceYaml } from "../lib/api-client";

// Props shared by the YAML button and the dialog: which resource to show.
type YamlTarget = {
    type: YamlResourceType;
    name: string;
    namespace?: string;
};

// Modal dialog that fetches and displays the raw YAML for a single resource.
// Fetching is gated on open so closed buttons do not issue requests.
function YamlDialog({ target, open, onClose }: { target: YamlTarget; open: boolean; onClose: () => void }) {
    const { current } = useKubeContext();

    const { data, error, isLoading } = useQuery({
        queryKey: ["yaml", current, target.type, target.namespace ?? "", target.name],
        queryFn: () => fetchResourceYaml(current!, target.type, target.name, target.namespace),
        enabled: open && current !== null,
    });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth data-test-id="yaml-dialog">
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FontAwesomeIcon icon={faFileCode} />
                    <Typography component="span" sx={{ fontWeight: 600 }}>
                        {target.name}
                    </Typography>
                </Box>
                <Tooltip title="Close">
                    <IconButton size="small" onClick={onClose} aria-label="close yaml" data-test-id="yaml-close">
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </Tooltip>
            </DialogTitle>
            <DialogContent>
                {error && <Alert severity="error">{(error as Error).message}</Alert>}
                <Paper
                    variant="outlined"
                    sx={{
                        p: 1.5,
                        bgcolor: "grey.900",
                        color: "grey.100",
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        overflow: "auto",
                        maxHeight: "70vh",
                        whiteSpace: "pre",
                    }}
                    data-test-id="yaml-content"
                >
                    {isLoading ? "Loading..." : (data?.yaml || "(no yaml)")}
                </Paper>
            </DialogContent>
        </Dialog>
    );
}

// A small "YAML" button that, when clicked, opens a dialog showing the raw YAML
// for the given resource. Reusable across every viewable resource type.
export function YamlButton({ type, name, namespace }: YamlTarget) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                size="small"
                variant="outlined"
                startIcon={<FontAwesomeIcon icon={faFileCode} />}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(true);
                }}
                data-test-id="yaml-button"
            >
                YAML
            </Button>
            {open && (
                <YamlDialog
                    target={{ type, name, namespace }}
                    open={open}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
