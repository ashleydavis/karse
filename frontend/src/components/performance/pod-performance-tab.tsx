import { Paper, Typography } from "@mui/material";

// Props for the pod Performance tab. `namespace`, `name`, and `active` mirror the
// eventual signature so the content ticket can fill the body in place without
// changing the call site.
type PodPerformanceTabProps = {
    namespace: string;
    name: string;
    active: boolean;
};

// Stub for the pod-level Performance tab. Renders a labelled placeholder only;
// no metrics fetch or charts yet. The content ticket replaces the body.
export function PodPerformanceTab({ namespace: _namespace, name: _name, active: _active }: PodPerformanceTabProps) {
    return (
        <Paper variant="outlined" sx={{ p: 3 }} data-test-id="perf-pod-stub">
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Performance
            </Typography>
            <Typography color="text.secondary">
                Performance metrics coming soon.
            </Typography>
        </Paper>
    );
}
