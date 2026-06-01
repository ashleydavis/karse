import { useState, useRef, useEffect } from "react";
import {
    Box,
    Typography,
    Paper,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    Alert,
    AlertTitle,
    Link,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTowerBroadcast, faMagnifyingGlass, faPlay, faStop } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import type { SternStreamLine } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNamespaces, openSternStream } from "../../lib/api-client";

// A rendered log line tagged with a stable key for React reconciliation.
type RenderedLine = SternStreamLine & { key: number };

// Stern-powered live log page. Unlike the kubectl-based Live Logs page, this
// shells out to the real `stern` binary on the backend, which natively tails and
// aggregates logs from every pod matching a query/wildcard/regex. If stern is
// not installed, the page shows install instructions instead of erroring.
export function SternPage() {
    const { current } = useKubeContext();
    const [namespace, setNamespace] = useState<string>("");
    const [query, setQuery] = useState<string>("");
    const [streaming, setStreaming] = useState(false);
    const [lines, setLines] = useState<RenderedLine[]>([]);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [unavailable, setUnavailable] = useState(false);

    // Holds the active stream's close function so it survives re-renders.
    const closeRef = useRef<(() => void) | null>(null);
    const keyRef = useRef(0);
    const logEndRef = useRef<HTMLDivElement | null>(null);

    const { data: namespacesData } = useQuery({
        queryKey: ["namespaces", current],
        queryFn: () => fetchNamespaces(current!),
        enabled: current !== null,
    });

    const namespaces = namespacesData?.namespaces ?? [];

    // Stops any active stream and clears the close handle.
    function stopStream(): void {
        if (closeRef.current) {
            closeRef.current();
            closeRef.current = null;
        }
        setStreaming(false);
    }

    // Tears down the stream when the component unmounts.
    useEffect(() => {
        return () => {
            if (closeRef.current) {
                closeRef.current();
                closeRef.current = null;
            }
        };
    }, []);

    // Auto-scrolls to the newest line as logs arrive.
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ block: "end" });
    }, [lines]);

    // Opens a fresh stern stream with the current scope, replacing any existing one.
    function startStream(): void {
        if (current === null) {
            return;
        }
        stopStream();
        setLines([]);
        setStreamError(null);
        setUnavailable(false);
        keyRef.current = 0;
        setStreaming(true);
        closeRef.current = openSternStream(current, namespace || undefined, query, 100, {
            onStarted: () => {
                // Stream opened; nothing extra to render beyond the lines.
            },
            onLine: (entry) => {
                setLines((prev) => {
                    const next = [...prev, { ...entry, key: keyRef.current++ }];
                    // Cap the buffer so a long-running stream cannot exhaust memory.
                    if (next.length > 5000) {
                        next.splice(0, next.length - 5000);
                    }
                    return next;
                });
            },
            onUnavailable: () => {
                setUnavailable(true);
                setStreaming(false);
                closeRef.current = null;
            },
            onError: (message) => {
                setStreamError(message);
            },
        });
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FontAwesomeIcon icon={faTowerBroadcast} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Stern
                </Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                <div data-test-id="stern-namespace-select">
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Namespace</InputLabel>
                        <Select
                            value={namespace}
                            label="Namespace"
                            onChange={(e) => setNamespace(e.target.value)}
                        >
                            <MenuItem value="" data-test-id="stern-namespace-option">All namespaces</MenuItem>
                            {namespaces.map((ns) => (
                                <MenuItem key={ns.name} value={ns.name} data-test-id="stern-namespace-option">{ns.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </div>

                <TextField
                    size="small"
                    label="Pod query (wildcard/regex, e.g. nginx-* or .*)"
                    placeholder="pod query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    data-test-id="stern-query"
                    sx={{ minWidth: 320 }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />

                {!streaming ? (
                    <Button
                        variant="contained"
                        onClick={startStream}
                        disabled={current === null}
                        data-test-id="stern-start"
                        startIcon={<FontAwesomeIcon icon={faPlay} />}
                    >
                        Stream
                    </Button>
                ) : (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={stopStream}
                        data-test-id="stern-stop"
                        startIcon={<FontAwesomeIcon icon={faStop} />}
                    >
                        Stop
                    </Button>
                )}
            </Paper>

            {unavailable && (
                <Alert severity="warning" data-test-id="stern-not-installed">
                    <AlertTitle>stern is not installed</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        This page streams logs using the <code>stern</code> CLI, which was not found on the
                        server&apos;s PATH. Install it, then press Stream again:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 3 }}>
                        <li><strong>macOS (Homebrew):</strong> <code>brew install stern</code></li>
                        <li><strong>Linux/macOS (Krew):</strong> <code>kubectl krew install stern</code></li>
                        <li>
                            <strong>Manual:</strong> download a release binary from{" "}
                            <Link href="https://github.com/stern/stern/releases" target="_blank" rel="noreferrer">
                                github.com/stern/stern/releases
                            </Link>{" "}
                            and place it on your PATH
                        </li>
                    </Box>
                </Alert>
            )}

            {streamError && <Alert severity="error" data-test-id="stern-error">{streamError}</Alert>}

            <Paper
                variant="outlined"
                sx={{
                    p: 1.5,
                    flex: 1,
                    minHeight: 300,
                    bgcolor: "grey.900",
                    color: "grey.100",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                }}
                data-test-id="stern-viewer"
            >
                {lines.length === 0 ? (
                    <Typography component="span" sx={{ color: "grey.500", fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {streaming ? "Waiting for log lines..." : "Pick a scope and press Stream."}
                    </Typography>
                ) : (
                    lines.map((entry) => (
                        <Box key={entry.key} component="div" data-test-id="stern-line">
                            {entry.line}
                        </Box>
                    ))
                )}
                <div ref={logEndRef} />
            </Paper>
        </Box>
    );
}
