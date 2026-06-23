// The shared toggle state for the resource-utilization surfaces (cluster Overview
// utilisation block, nodes table, node-detail performance panel and pods table, pods
// table). A single provider holds the View mode (usage/requests) and Value format
// (percent/absolute) so one choice drives every bar in the wrapped section together.
// Pure UI state only — no I/O — kept here rather than in each page so the toggles stay in
// sync. See resource-utilization.ts for the ViewMode / ValueFormat meanings.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ViewMode, ValueFormat } from "./resource-utilization";

// The shared utilisation toggle state plus its setters, provided to a wrapped section.
type ResourceUtilizationValue = {
    mode: ViewMode;
    format: ValueFormat;
    setMode: (mode: ViewMode) => void;
    setFormat: (format: ValueFormat) => void;
};

// React context holding the shared utilisation toggle state. Null until a provider mounts,
// so useResourceUtilization can throw a clear error when used outside one.
const Ctx = createContext<ResourceUtilizationValue | null>(null);

// Provides the shared View-mode / Value-format toggle state to the wrapped section.
// Defaults to View "usage" + Value "percent" (the prototype defaults).
export function ResourceUtilizationProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ViewMode>("usage");
    const [format, setFormat] = useState<ValueFormat>("percent");
    const value: ResourceUtilizationValue = {
        mode,
        format,
        setMode,
        setFormat,
    };
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Returns the shared utilisation toggle state and setters. Must be called inside a
// <ResourceUtilizationProvider>.
export function useResourceUtilization(): ResourceUtilizationValue {
    const value = useContext(Ctx);
    if (value === null) {
        throw new Error("useResourceUtilization must be used inside <ResourceUtilizationProvider>");
    }
    return value;
}
