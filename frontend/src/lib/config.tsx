import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import type { TimestampMode } from "./timestamps";

const STORAGE_KEY = "karse-config";

type ColorMode = "light" | "dark" | "system";

type Config = {
    colorMode: ColorMode;
    timestampMode: TimestampMode;
};

type ConfigContextValue = {
    config: Config;
    resolvedColorMode: "light" | "dark";
    setColorMode: (mode: ColorMode) => void;
    setTimestampMode: (mode: TimestampMode) => void;
};

// Timestamps default to "age" because that is how Karse has always shown them
// (and how `kubectl get` shows them), so the default view is unchanged.
const defaultConfig: Config = {
    colorMode: "system",
    timestampMode: "age",
};

function loadConfig(): Config {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
    } catch {
        // ignore
    }
    return defaultConfig;
}

function saveConfig(config: Config): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

const ConfigContext = createContext<ConfigContextValue>({
    config: defaultConfig,
    resolvedColorMode: "light",
    setColorMode: () => {},
    setTimestampMode: () => {},
});

export function ConfigProvider({ children }: { children: ReactNode }) {
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [config, setConfig] = useState<Config>(loadConfig);

    const resolvedColorMode: "light" | "dark" =
        config.colorMode === "system" ? (prefersDark ? "dark" : "light") : config.colorMode;

    const value = useMemo<ConfigContextValue>(() => ({
        config,
        resolvedColorMode,
        setColorMode: (mode) => {
            const next = { ...config, colorMode: mode };
            setConfig(next);
            saveConfig(next);
        },
        // Persisted alongside the colour mode, so the chosen timestamp format
        // survives navigation and a page reload.
        setTimestampMode: (mode) => {
            const next = { ...config, timestampMode: mode };
            setConfig(next);
            saveConfig(next);
        },
    }), [config, resolvedColorMode]);

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
    return useContext(ConfigContext);
}
