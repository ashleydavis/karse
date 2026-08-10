import { useState, useEffect } from "react";
import {
    Paper,
    Typography,
    TextField,
    Button,
    Stack,
    Select,
    MenuItem,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faArrowDown, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useConfig } from "../../../lib/config";
import { EnvironmentChip } from "../../../components/environment-chip";
import {
    environmentId,
    validatePattern,
    validateEnvironmentName,
    DEFAULT_ENVIRONMENTS,
    ENVIRONMENT_COLORS,
    type EnvironmentColor,
    type EnvironmentDefinition,
} from "../../../lib/cluster-environments";

// The Config page's environments tab: the user's own environment list, in order. Each row is
// a name, the regular expression matched against a whole context name, and the chip colour.
// The first environment in the list whose expression matches a context name wins, so moving a
// row changes precedence. The list is stored in the `karse-config` local-storage entry.
export function EnvironmentsSettings() {
    const { config: { environments }, setEnvironments } = useConfig();

    // The rows as they are being edited. Kept separate from the stored list so an invalid
    // expression can be typed and reported without ever being saved: a row is written back
    // only once every row is valid.
    const [rows, setRows] = useState<EnvironmentDefinition[]>(environments);
    const [newName, setNewName] = useState("");
    const [newPattern, setNewPattern] = useState("");
    const [newColor, setNewColor] = useState<EnvironmentColor>("info");
    const [resetOpen, setResetOpen] = useState(false);

    // Re-seed the editable rows whenever the stored list changes, so a save made here (and a
    // reset) is reflected back. An invalid edit saves nothing, so it leaves the stored list
    // untouched and the half-typed text stands.
    useEffect(() => {
        setRows(environments);
    }, [environments]);

    // Saves the list only when every row is usable, which is what keeps an invalid expression
    // out of storage entirely.
    function save(next: EnvironmentDefinition[]): void {
        setRows(next);
        const usable = next.every((row) => validatePattern(row.pattern) === null && validateEnvironmentName(row.name) === null);
        if (usable) {
            setEnvironments(next);
        }
    }

    function updateRow(index: number, patch: Partial<EnvironmentDefinition>): void {
        save(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
    }

    function deleteRow(index: number): void {
        save(rows.filter((_, position) => position !== index));
    }

    // Moves a row one place up or down. Order is precedence, so this is how the user decides
    // which environment wins a context name that matches two of them.
    function moveRow(index: number, delta: number): void {
        const target = index + delta;
        if (target < 0 || target >= rows.length) {
            return;
        }
        const next = rows.slice();
        const moved = next[index];
        next.splice(index, 1);
        next.splice(target, 0, moved);
        save(next);
    }

    const addNameError = validateEnvironmentName(newName);
    const addPatternError = validatePattern(newPattern);

    function addRow(): void {
        if (addNameError !== null || addPatternError !== null) {
            return;
        }
        save([
            ...rows,
            {
                id: environmentId(newName, rows),
                name: newName,
                pattern: newPattern,
                color: newColor,
            },
        ]);
        setNewName("");
        setNewPattern("");
    }

    function resetToDefaults(): void {
        setResetOpen(false);
        save(DEFAULT_ENVIRONMENTS);
    }

    return (
        <Paper variant="outlined" sx={{ p: 3, maxWidth: 980 }} data-test-id="config-environments-panel">
            <Typography variant="h6" gutterBottom>
                Environments
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Every kubeconfig context is grouped under the <strong>first</strong> environment
                below whose regular expression matches its name, so the order is the precedence.
                Matching is case-insensitive and runs against the whole context name. A context
                matching none of them is <strong>Unassigned</strong>, which is built in and is not
                a row here: clearing the list puts every context under it.
            </Typography>

            {rows.length === 0 && (
                <Typography color="text.secondary" sx={{ mb: 2 }} data-test-id="config-environments-empty">
                    No environments. Every context is Unassigned.
                </Typography>
            )}

            <Stack spacing={2} sx={{ mb: 3 }}>
                {rows.map((row, index) => {
                    const nameError = validateEnvironmentName(row.name);
                    const patternError = validatePattern(row.pattern);
                    return (
                        <Stack
                            key={row.id}
                            direction="row"
                            spacing={2}
                            sx={{ alignItems: "flex-start" }}
                            data-test-id="config-environment-row"
                            data-environment={row.id}
                        >
                            <EnvironmentChip
                                environment={row}
                                source="inferred"
                                testId="config-environment-chip"
                            />
                            <TextField
                                label="Name"
                                size="small"
                                value={row.name}
                                onChange={(event) => updateRow(index, { name: event.target.value })}
                                error={nameError !== null}
                                helperText={nameError ?? " "}
                                slotProps={{ htmlInput: { "data-test-id": "config-environment-name-input" } }}
                                sx={{ width: 180 }}
                            />
                            <TextField
                                label="Matches (regex)"
                                size="small"
                                value={row.pattern}
                                onChange={(event) => updateRow(index, { pattern: event.target.value })}
                                error={patternError !== null}
                                helperText={patternError ?? " "}
                                slotProps={{ htmlInput: { "data-test-id": "config-environment-pattern-input" } }}
                                sx={{ flex: 1, minWidth: 260 }}
                            />
                            <Select
                                size="small"
                                value={row.color}
                                onChange={(event) => updateRow(index, { color: event.target.value })}
                                data-test-id="config-environment-color-select"
                                inputProps={{ "aria-label": `colour for ${row.name}` }}
                                sx={{ width: 140 }}
                            >
                                {ENVIRONMENT_COLORS.map((color) => (
                                    <MenuItem key={color} value={color}>
                                        {color}
                                    </MenuItem>
                                ))}
                            </Select>
                            <IconButton
                                size="small"
                                disabled={index === 0}
                                onClick={() => moveRow(index, -1)}
                                data-test-id="config-environment-up"
                                aria-label={`move ${row.name} up`}
                            >
                                <FontAwesomeIcon icon={faArrowUp} />
                            </IconButton>
                            <IconButton
                                size="small"
                                disabled={index === rows.length - 1}
                                onClick={() => moveRow(index, 1)}
                                data-test-id="config-environment-down"
                                aria-label={`move ${row.name} down`}
                            >
                                <FontAwesomeIcon icon={faArrowDown} />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={() => deleteRow(index)}
                                data-test-id="config-environment-delete"
                                aria-label={`delete ${row.name}`}
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </IconButton>
                        </Stack>
                    );
                })}
            </Stack>

            <Typography variant="subtitle2" gutterBottom>
                Add an environment
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", mb: 3 }}>
                <TextField
                    label="Name"
                    size="small"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    slotProps={{ htmlInput: { "data-test-id": "config-environments-add-name" } }}
                    sx={{ width: 180 }}
                />
                <TextField
                    label="Matches (regex)"
                    size="small"
                    value={newPattern}
                    onChange={(event) => setNewPattern(event.target.value)}
                    error={newPattern !== "" && addPatternError !== null}
                    helperText={newPattern !== "" && addPatternError !== null ? addPatternError : " "}
                    slotProps={{ htmlInput: { "data-test-id": "config-environments-add-pattern" } }}
                    sx={{ flex: 1, minWidth: 260 }}
                />
                <Select
                    size="small"
                    value={newColor}
                    onChange={(event) => setNewColor(event.target.value)}
                    data-test-id="config-environments-add-color"
                    inputProps={{ "aria-label": "colour for the new environment" }}
                    sx={{ width: 140 }}
                >
                    {ENVIRONMENT_COLORS.map((color) => (
                        <MenuItem key={color} value={color}>
                            {color}
                        </MenuItem>
                    ))}
                </Select>
                <Button
                    variant="contained"
                    onClick={addRow}
                    disabled={addNameError !== null || addPatternError !== null}
                    data-test-id="config-environments-add-button"
                    sx={{ mt: 0.25 }}
                >
                    Add
                </Button>
            </Stack>

            <Stack direction="row" spacing={2}>
                <Button
                    variant="outlined"
                    color="error"
                    onClick={() => save([])}
                    disabled={rows.length === 0}
                    data-test-id="config-environments-clear"
                >
                    Clear the list
                </Button>
                <Button
                    variant="outlined"
                    onClick={() => setResetOpen(true)}
                    data-test-id="config-environments-reset"
                >
                    Reset to defaults
                </Button>
            </Stack>

            <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
                <DialogTitle data-test-id="config-environments-reset-dialog">
                    Reset environments to the defaults?
                </DialogTitle>
                <DialogContent>
                    <DialogContentText data-test-id="config-environments-reset-message">
                        This discards your custom environments: every environment you have added,
                        renamed, re-matched, reordered or deleted is lost, and the list Karse ships
                        with is put back. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setResetOpen(false)}
                        data-test-id="config-environments-reset-cancel"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={resetToDefaults}
                        data-test-id="config-environments-reset-confirm"
                    >
                        Reset to defaults
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
