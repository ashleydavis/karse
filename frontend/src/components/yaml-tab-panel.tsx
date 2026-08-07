import { useLayoutEffect, useRef, useState } from "react";
import { Box, Alert, Paper } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { fetchResourceYaml } from "../lib/api-client";
import { LoadingIndicator } from "./loading-indicator";
import { CopyButton } from "./copy-button";

// Which resource to fetch YAML for. `type` is the kind's kubectl resource name, e.g.
// "pods" or "horizontalpodautoscalers". namespace is omitted for cluster-scoped resources
// (nodes, namespaces) and supplied for namespaced ones.
type YamlTarget = {
    type: string;
    name: string;
    namespace?: string;
};

// Renders the raw YAML for a single resource inside a detail-page sub tab.
// Fetching is gated on `active` so the request only fires when the tab is open.
export function YamlTabPanel({ target, active }: { target: YamlTarget; active: boolean }) {
    const { current } = useKubeContext();
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

    return (
        <Box data-test-id="yaml-panel">
            {error && <Alert severity="error">{(error as Error).message}</Alert>}
            <Box sx={{ position: "relative" }}>
                <span style={{ position: "absolute", top: 8, right: 8 + scrollbarWidth, zIndex: 1 }}>
                    <CopyButton
                        text={yaml}
                        label="yaml"
                        testId="yaml-copy-button"
                        tooltip="Copy YAML"
                        disabled={!yaml}
                        sx={{
                            color: "grey.100",
                            bgcolor: "grey.800",
                            "&:hover": {
                                bgcolor: "grey.700",
                            },
                        }}
                    />
                </span>
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
