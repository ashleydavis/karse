import { Chip, Select, MenuItem, type SelectChangeEvent } from "@mui/material";
import type { Context } from "karse-types";

type Props = {
    contexts: Context[];
    current: string | null;
    onSwitch: (name: string) => void;
};

export function ContextPicker({ contexts, current, onSwitch }: Props) {
    function handleChange(e: SelectChangeEvent) {
        if (e.target.value !== current) {
            onSwitch(e.target.value);
        }
    }

    if (contexts.length <= 1) {
        return <Chip label={current ?? "no context"} size="small" variant="outlined" />;
    }

    return (
        <Select
            value={current ?? ""}
            onChange={handleChange}
            size="small"
            variant="outlined"
        >
            {contexts.map((ctx) => (
                <MenuItem key={ctx.name} value={ctx.name}>
                    {ctx.name}
                </MenuItem>
            ))}
        </Select>
    );
}
