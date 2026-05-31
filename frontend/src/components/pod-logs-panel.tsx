import { useState } from "react";
import {
    Box,
    Alert,
    Paper,
    IconButton,
    Tooltip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { fetchPodLogs } from "../lib/api-client";

// Fetches and displays logs for a pod, with container and tail-line selectors.
export function PodLogsPanel({ namespace, podName, containers }: {
    namespace: string;
    podName: string;
    containers: string[];
}) {
    const { current } = useKubeContext();
    const [selectedContainer, setSelectedContainer] = useState(containers[0] ?? "");
    const [tail, setTail] = useState(100);

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["logs", current, namespace, podName, selectedContainer, tail],
        queryFn: () => fetchPodLogs(current!, namespace, podName, selectedContainer || undefined, tail),
        enabled: containers.length > 0,
    });

    return (
        <Box data-test-id="pod-logs-panel">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                {containers.length > 1 && (
                    <div data-test-id="log-container-select">
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Container</InputLabel>
                            <Select
                                value={selectedContainer}
                                label="Container"
                                onChange={(e) => setSelectedContainer(e.target.value)}
                            >
                                {containers.map((c) => (
                                    <MenuItem key={c} value={c} data-test-id="log-container-option">{c}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </div>
                )}
                <div data-test-id="log-tail-select">
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Tail lines</InputLabel>
                        <Select
                            value={tail}
                            label="Tail lines"
                            onChange={(e) => setTail(Number(e.target.value))}
                        >
                            {[50, 100, 200, 500].map((n) => (
                                <MenuItem key={n} value={n} data-test-id="log-tail-option">{n}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>
                <Tooltip title="Refresh logs">
                    <IconButton size="small" onClick={() => refetch()} disabled={isLoading} aria-label="refresh logs" data-test-id="log-refresh">
                        <FontAwesomeIcon icon={["fas", "rotate"]} />
                    </IconButton>
                </Tooltip>
            </Box>
            {error && <Alert severity="error">{(error as Error).message}</Alert>}
            <Paper
                variant="outlined"
                sx={{
                    p: 1.5,
                    bgcolor: "grey.900",
                    color: "grey.100",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    overflowY: "auto",
                    maxHeight: 400,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                }}
                data-test-id="log-viewer"
            >
                {isLoading ? "Loading..." : (data?.logs || "(no logs)")}
            </Paper>
        </Box>
    );
}
