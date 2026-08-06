import { createContext, useContext, useState, ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import type { TimestampMode } from "./timestamps";
import type { ClusterEnvironment, EnvironmentLabels } from "./cluster-environments";

const STORAGE_KEY = "karse-config";

type ColorMode = "light" | "dark" | "system";

type Config = {
    colorMode: ColorMode;
    timestampMode: TimestampMode;
    // The developer's explicit environment labels, keyed by context name. A context with no
    // entry here falls back to the environment inferred from its name.
    contextEnvironments: EnvironmentLabels;
};

type ConfigContextValue = {
    config: Config;
    resolvedColorMode: "light" | "dark";
    setColorMode: (mode: ColorMode) => void;
    setTimestampMode: (mode: TimestampMode) => void;
    setContextEnvironment: (context: string, environment: ClusterEnvironment | null) => void;
};

// Timestamps default to "age" because that is how Karse has always shown them
// (and how `kubectl get` shows them), so the default view is unchanged.
//
// No context is labelled by default, so every context starts on its inferred environment.
const defaultConfig: Config = {
    colorMode: "system",
    timestampMode: "age",
    contextEnvironments: {},
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
    setContextEnvironment: () => {},
});

export function ConfigProvider({ children }: { children: ReactNode }) {
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [config, setConfig] = useState<Config>(loadConfig);

    const resolvedColorMode: "light" | "dark" =
        config.colorMode === "system" ? (prefersDark ? "dark" : "light") : config.colorMode;

    const value: ConfigContextValue = {
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
        // Labels a context with an environment, or clears the label when passed null so the
        // context falls back to the environment inferred from its name. Stored in the same
        // `karse-config` entry as the other UI settings, so a label survives a reload and an
        // app restart. A cleared label is deleted rather than blanked, so nothing distinguishes
        // "never labelled" from "label removed".
        setContextEnvironment: (context, environment) => {
            const contextEnvironments = { ...config.contextEnvironments };
            if (environment === null) {
                delete contextEnvironments[context];
            }
            else {
                contextEnvironments[context] = environment;
            }
            const next = { ...config, contextEnvironments };
            setConfig(next);
            saveConfig(next);
        },
    };

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
    return useContext(ConfigContext);
}
