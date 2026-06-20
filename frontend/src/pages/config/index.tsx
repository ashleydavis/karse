import { useState, useEffect } from "react";
import { Box, Paper, Typography, TextField, Button, Alert, Stack } from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCacheConfig, setCacheConfig } from "../../lib/api-client";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";

// Config page: the on-disk cluster-data cache settings. Currently exposes the
// staleness threshold (seconds) that decides how long cached kubectl data is served
// before Karse re-fetches it from the cluster. The value is persisted server-side.
export function ConfigPage() {
    const qc = useQueryClient();
    const { data, isLoading, error } = useQuery({
        queryKey: ["cache-config"],
        queryFn: fetchCacheConfig,
    });

    // The text field's working value, seeded from the loaded config. Kept as a string
    // so the field can be cleared/edited freely before being parsed on save.
    const [value, setValue] = useState<string>("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (data) {
            setValue(String(data.stalenessSeconds));
        }
    }, [data]);

    const mutation = useMutation({
        mutationFn: (seconds: number) => setCacheConfig(seconds),
        onSuccess: (result) => {
            qc.setQueryData(["cache-config"], result);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2000);
        },
    });

    if (isLoading) {
        return <LoadingIndicator />;
    }
    if (error) {
        return <LoadError message={(error as Error).message} />;
    }

    const parsed = Number(value);
    const invalid = value.trim() === "" || !Number.isFinite(parsed) || parsed < 0;

    function handleSave(): void {
        if (!invalid) {
            mutation.mutate(parsed);
        }
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }} data-test-id="config-cache-panel">
                <Typography variant="h6" gutterBottom>
                    Cluster data cache
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Karse caches data fetched with <code>kubectl</code> on disk to avoid
                    re-running it on every request. Cached data older than the staleness
                    threshold below is re-fetched from the cluster; newer data is served
                    from the cache. The navbar refresh button empties the cache. Set the
                    threshold to <strong>0</strong> to disable the cache entirely.
                </Typography>
                <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                    <TextField
                        label="Staleness threshold (seconds)"
                        type="number"
                        size="small"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        error={invalid}
                        helperText={invalid ? "Enter a number of seconds (0 or more)." : " "}
                        slotProps={{ htmlInput: { min: 0, "data-test-id": "config-staleness-input" } }}
                        sx={{ width: 260 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={invalid || mutation.isPending}
                        data-test-id="config-save-button"
                        sx={{ mt: 0.25 }}
                    >
                        Save
                    </Button>
                </Stack>
                {saved && (
                    <Alert severity="success" sx={{ mt: 2 }} data-test-id="config-saved-alert">
                        Saved.
                    </Alert>
                )}
                {mutation.isError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {(mutation.error as Error).message}
                    </Alert>
                )}
            </Paper>
        </Box>
    );
}
