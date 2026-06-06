import { useState, useCallback } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";

// Persisted, per-table configuration of which columns are visible and the order to show them in.
// `order` lists every configurable column id in display order. `hidden` is the set of column ids
// the user has moved to the Hidden section. Stored in localStorage keyed by the table id so the
// configuration survives navigation and reload.
export type ColumnConfig = {
    order: string[];
    hidden: string[];
};

// localStorage key prefix for a table's column configuration. The table id is appended.
const STORAGE_PREFIX = "karse-columns-";

// Builds the localStorage key for a given table id.
function storageKey(tableId: string): string {
    return `${STORAGE_PREFIX}${tableId}`;
}

// A configurable column descriptor: its stable id and the human label shown in the modal.
export type ConfigurableColumn = {
    id: string;
    label: string;
};

// Derives the stable column id used by TanStack Table for a column definition.
// Mirrors TanStack's own resolution: an explicit `id`, else the `accessorKey`.
function columnId<T>(col: ColumnDef<T>): string {
    if (col.id !== undefined) {
        return col.id;
    }
    if ("accessorKey" in col && typeof col.accessorKey === "string") {
        return col.accessorKey;
    }
    throw new Error("Column has neither an id nor a string accessorKey; cannot configure it.");
}

// Extracts the human-readable label for a column, falling back to its id when the
// header is not a plain string (e.g. a render function or empty action column).
function columnLabel<T>(col: ColumnDef<T>, id: string): string {
    if (typeof col.header === "string" && col.header.length > 0) {
        return col.header;
    }
    return id;
}

// The list of columns a user may configure: every column whose `enableHiding` is not
// explicitly false. Action columns opt out by setting `enableHiding: false`.
function configurableColumns<T>(columns: ColumnDef<T>[]): ConfigurableColumn[] {
    const result: ConfigurableColumn[] = [];
    for (const col of columns) {
        if (col.enableHiding === false) {
            continue;
        }
        const id = columnId(col);
        result.push({
            id,
            label: columnLabel(col, id),
        });
    }
    return result;
}

// Reads a saved configuration from localStorage, returning null when absent or invalid.
function loadConfig(tableId: string): ColumnConfig | null {
    try {
        const raw = localStorage.getItem(storageKey(tableId));
        if (raw === null) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) {
            return null;
        }
        return {
            order: parsed.order,
            hidden: parsed.hidden,
        };
    }
    catch {
        return null;
    }
}

// Persists a configuration to localStorage for a table.
function saveConfig(tableId: string, config: ColumnConfig): void {
    localStorage.setItem(storageKey(tableId), JSON.stringify(config));
}

// Reconciles a saved configuration against the current column set: drops ids that no
// longer exist and appends any newly-added configurable columns to the end of the order.
function reconcile(saved: ColumnConfig | null, configurable: ConfigurableColumn[]): ColumnConfig {
    const validIds = new Set(configurable.map((c) => c.id));
    if (saved === null) {
        return {
            order: configurable.map((c) => c.id),
            hidden: [],
        };
    }
    const order: string[] = [];
    for (const id of saved.order) {
        if (validIds.has(id)) {
            order.push(id);
        }
    }
    for (const c of configurable) {
        if (!order.includes(c.id)) {
            order.push(c.id);
        }
    }
    const hidden = saved.hidden.filter((id) => validIds.has(id));
    return {
        order,
        hidden,
    };
}

// The value returned by useColumnConfig: state to feed into TanStack Table plus the data and
// callbacks the configuration modal needs.
export type UseColumnConfigResult = {
    // Column ids in user-chosen display order, fed to TanStack Table's `columnOrder` state.
    columnOrder: string[];
    // Per-column visibility map fed to TanStack Table's `columnVisibility` state.
    columnVisibility: VisibilityState;
    // Configurable columns (id + label), in the table's natural definition order, for lookups.
    configurable: ConfigurableColumn[];
    // The current configuration (order + hidden), for the modal to render.
    config: ColumnConfig;
    // Replaces the configuration and persists it.
    setConfig: (next: ColumnConfig) => void;
};

// Hook that manages a table's persisted column configuration (visibility + order).
// Pass a stable `tableId` (used as the storage key) and the table's full column definitions.
// Feed `columnOrder` and `columnVisibility` into useReactTable's state.
export function useColumnConfig<T>(tableId: string, columns: ColumnDef<T>[]): UseColumnConfigResult {
    const configurable = configurableColumns(columns);
    const [config, setConfigState] = useState<ColumnConfig>(() => reconcile(loadConfig(tableId), configurable));

    const setConfig = useCallback((next: ColumnConfig) => {
        setConfigState(next);
        saveConfig(tableId, next);
    }, [tableId]);

    // TanStack needs every column in the order array; non-configurable columns (e.g. actions)
    // are appended so they keep their place at the end of the row.
    const allIds = columns.map((col) => columnId(col));
    const configurableInOrder = config.order.filter((id) => allIds.includes(id));
    const nonConfigurable = allIds.filter((id) => !configurable.some((c) => c.id === id));
    const columnOrder = [...configurableInOrder, ...nonConfigurable];

    const columnVisibility: VisibilityState = {};
    for (const id of config.hidden) {
        columnVisibility[id] = false;
    }

    return {
        columnOrder,
        columnVisibility,
        configurable,
        config,
        setConfig,
    };
}
