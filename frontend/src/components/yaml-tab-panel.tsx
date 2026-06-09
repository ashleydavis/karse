import { useLayoutEffect, useRef, useState } from "react";
import { Box, Alert, Paper, Tooltip, IconButton } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faCheck } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { YamlResourceType } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchResourceYaml } from "../lib/api-client";
import { LoadingIndicator } from "./loading-indicator";

// Which resource to fetch YAML for. namespace is omitted for cluster-scoped
// resources (nodes, namespaces) and supplied for namespaced ones.
type YamlTarget = {
    type: YamlResourceType;
    name: string;
    namespace?: string;
};

// Renders the raw YAML for a single resource inside a detail-page sub tab.
// Fetching is gated on `active` so the request only fires when the tab is open.
export function YamlTabPanel({ target, active }: { target: YamlTarget; active: boolean }) {
    const { current } = useKubeContext();
    const [copied, setCopied] = useState(false);
    // The YAML scrolls inside this Paper. When its vertical scrollbar is visible
    // the copy button must be inset by the scrollbar's width so it never overlaps.
    const contentRef = useRef<HTMLDivElement>(null);
    const [scrollbarWidth, setScrollbarWidth] = useState(0);

    const { data, error, isLoading } = useQuery({
        queryKey: ["yaml", current, target.type, target.namespace ?? "", target.name],
        queryFn: () => fetchResourceYaml(current!, target.type, target.name, target.namespace),
        enabled: active && current !== null,
    });

    const yaml = data?.yaml ?? "";
    // Measure the live scrollbar width (offsetWidth - clientWidth) after each
    // render so the button offset tracks whether the content currently scrolls.
    useLayoutEffect(() => {
        const node = contentRef.current;
        if (node === null) {
            return;
        }
        setScrollbarWidth(node.offsetWidth - node.clientWidth);
    }, [yaml, isLoading, active]);
    // Copy the displayed YAML to the clipboard, briefly flipping the button to a
    // "Copied" confirmation. Matches the shareable-link copy pattern in header.tsx.
    async function handleCopy(): Promise<void> {
        await navigator.clipboard.writeText(yaml);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }

    return (
        <Box data-test-id="yaml-panel">
            {error && <Alert severity="error">{(error as Error).message}</Alert>}
            <Box sx={{ position: "relative" }}>
                <Tooltip title={copied ? "Copied" : "Copy YAML"}>
                    <span style={{ position: "absolute", top: 8, right: 8 + scrollbarWidth, zIndex: 1 }}>
                        <IconButton
                            size="small"
                            onClick={handleCopy}
                            disabled={!yaml}
                            aria-label="copy yaml"
                            data-test-id="yaml-copy-button"
                            sx={{ color: "grey.100", bgcolor: "grey.800", "&:hover": { bgcolor: "grey.700" } }}
                        >
                            <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                        </IconButton>
                    </span>
                </Tooltip>
                <Paper
                    ref={contentRef}
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
                    {isLoading ? <LoadingIndicator /> : (data?.yaml || "(no yaml)")}
                </Paper>
            </Box>
        </Box>
    );
}
