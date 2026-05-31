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
function ContainerTable({ containers, rowTestId, emptyAllowed }: {
    containers: ContainerInfo[];
    rowTestId: string;
    emptyAllowed: boolean;
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
                        <TableRow key={c.name} data-test-id={rowTestId}>
                            <TableCell sx={{ fontFamily: "monospace" }}>{c.name}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.image}</TableCell>
                            <TableCell><ContainerStateChip state={c.state} reason={c.stateReason} /></TableCell>
                            <TableCell>{c.ready ? "Yes" : "No"}</TableCell>
                            <TableCell>{c.restarts}</TableCell>
                        </TableRow>
                    ))}
                    {emptyAllowed && containers.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5}>
                                <Typography color="text.secondary">No containers.</Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

// Displays a pod's containers and, when present, its init containers.
export function PodContainersPanel({ containers, initContainers }: {
    containers: ContainerInfo[];
    initContainers: ContainerInfo[];
}) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Containers</Typography>
                <ContainerTable containers={containers} rowTestId="container-row" emptyAllowed={true} />
            </Paper>

            {initContainers.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Init Containers</Typography>
                    <ContainerTable containers={initContainers} rowTestId="init-container-row" emptyAllowed={false} />
                </Paper>
            )}
        </Box>
    );
}
