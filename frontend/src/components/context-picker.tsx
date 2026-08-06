import { Box, Chip, ListSubheader, Select, MenuItem, type SelectChangeEvent } from "@mui/material";
import type { Context } from "karse-types";
import { useConfig } from "../lib/config";
import { groupByEnvironment, resolveEnvironment } from "../lib/cluster-environments";
import { EnvironmentChip } from "./environment-chip";

type Props = {
    contexts: Context[];
    current: string | null;
    onSwitch: (name: string) => void;
};

export function ContextPicker({ contexts, current, onSwitch }: Props) {
    const { config: { contextEnvironments } } = useConfig();

    function handleChange(e: SelectChangeEvent) {
        if (e.target.value !== current) {
            onSwitch(e.target.value);
        }
    }

    // The active context's environment, shown beside the picker so it is obvious when the
    // current view is pointed at production, without opening anything. Resolved through the
    // same module the contexts page and the quick-picker use.
    const activeEnvironment = current === null ? null : resolveEnvironment(current, contextEnvironments);

    // The dropdown's entries, under one subheading per environment, in the same fixed order
    // the contexts page groups by.
    const groups = groupByEnvironment(contexts, contextEnvironments);

    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
            {activeEnvironment !== null && (
                <EnvironmentChip
                    environment={activeEnvironment.environment}
                    source={activeEnvironment.source}
                    testId="header-environment-chip"
                />
            )}
            {contexts.length <= 1 ? (
                <Chip label={current ?? "no context"} size="small" variant="outlined" />
            ) : (
                <Select
                    value={current ?? ""}
                    onChange={handleChange}
                    size="small"
                    variant="outlined"
                >
                    {groups.flatMap((group) => [
                        <ListSubheader
                            key={`group-${group.environment}`}
                            data-test-id="context-picker-group"
                            data-environment={group.environment}
                        >
                            {group.label}
                        </ListSubheader>,
                        ...group.items.map((ctx) => (
                            <MenuItem key={ctx.name} value={ctx.name}>
                                {ctx.name}
                            </MenuItem>
                        )),
                    ])}
                </Select>
            )}
        </Box>
    );
}
