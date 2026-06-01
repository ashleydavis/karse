import {
    Box,
    Typography,
    Chip,
    Paper,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    TableContainer,
} from "@mui/material";
import type { ContainerState, ContainerInfo } from "karse-types";
import { tableRowSx } from "../../../lib/table-row-style";

// Renders a colored chip describing a container's current state.
function ContainerStateChip({ state, reason }: { state: ContainerState; reason: string }) {
    const label = reason ? `${state}: ${reason}` : state;
    if (state === "Running") {
        return <Chip label="Running" color="success" size="small" />;
    }
    if (state === "Waiting") {
        return <Chip label={label} color="warning" size="small" />;
    }
    if (state === "Terminated") {
        return <Chip label={label} color="default" size="small" />;
    }
    return <Chip label="Unknown" size="small" />;
}

// Renders a single table of containers with their image, state, readiness and restarts.
function ContainerTable({ containers, rowTestId, emptyMessage }: {
    containers: ContainerInfo[];
    rowTestId: string;
    emptyMessage: string;
}) {
    return (
        <TableContainer>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Image</TableCell>
                        <TableCell>State</TableCell>
                        <TableCell>Ready</TableCell>
                        <TableCell>Restarts</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {containers.map((c) => (
                        <TableRow key={c.name} data-test-id={rowTestId} sx={tableRowSx(false)}>
                            <TableCell sx={{ fontFamily: "monospace" }}>{c.name}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.image}</TableCell>
                            <TableCell><ContainerStateChip state={c.state} reason={c.stateReason} /></TableCell>
                            <TableCell>{c.ready ? "Yes" : "No"}</TableCell>
                            <TableCell>{c.restarts}</TableCell>
                        </TableRow>
                    ))}
                    {containers.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5}>
                                <Typography color="text.secondary">{emptyMessage}</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

// Displays a pod's regular (non-init) containers in a table.
export function PodContainersPanel({ containers }: { containers: ContainerInfo[] }) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Containers</Typography>
                <ContainerTable containers={containers} rowTestId="container-row" emptyMessage="No containers." />
            </Paper>
        </Box>
    );
}

// Displays a pod's init containers in a table.
export function PodInitContainersPanel({ initContainers }: { initContainers: ContainerInfo[] }) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Init Containers</Typography>
                <ContainerTable containers={initContainers} rowTestId="init-container-row" emptyMessage="No init containers." />
            </Paper>
        </Box>
    );
}
