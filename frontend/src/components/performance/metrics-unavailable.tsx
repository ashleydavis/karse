import { Alert } from "@mui/material";

// Shown on a Performance view when the cluster has no Metrics API (metricsAvailable
// is false). Explains why live usage is missing and that only the requests/limits
// read from pod specs are shown, so the view degrades clearly rather than appearing
// broken or empty.
export function MetricsUnavailable() {
    return (
        <Alert severity="info" data-test-id="perf-metrics-unavailable">
            The Kubernetes Metrics API is not available on this cluster, so live CPU and
            memory usage cannot be read. Only the requests and limits declared in pod
            specs are shown.
        </Alert>
    );
}
