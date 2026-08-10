import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import type { TimestampMode } from "./timestamps";
import {
    compileEnvironments,
    normalizeEnvironments,
    DEFAULT_ENVIRONMENTS,
    type CompiledEnvironment,
    type EnvironmentDefinition,
    type EnvironmentLabels,
} from "./cluster-environments";

const STORAGE_KEY = "karse-config";

type ColorMode = "light" | "dark" | "system";

type Config = {
    colorMode: ColorMode;
    timestampMode: TimestampMode;
    // The developer's explicit environment labels, keyed by context name and valued by
    // environment id. A context with no entry here falls back to the environment whose
    // expression matches its name.
    contextEnvironments: EnvironmentLabels;
    // The user's ordered environment list. Order decides precedence: the first environment
    // whose expression matches a context name wins.
    environments: EnvironmentDefinition[];
};

type ConfigContextValue = {
    config: Config;
    // The environment list with its expressions already compiled, rebuilt only when the list
    // changes rather than once per context per render.
    compiledEnvironments: CompiledEnvironment[];
    resolvedColorMode: "light" | "dark";
    setColorMode: (mode: ColorMode) => void;
    setTimestampMode: (mode: TimestampMode) => void;
    setContextEnvironment: (context: string, environmentId: string | null) => void;
    setEnvironments: (environments: EnvironmentDefinition[]) => void;
};

// Timestamps default to "age" because that is how Karse has always shown them
// (and how `kubectl get` shows them), so the default view is unchanged.
//
// No context is labelled by default, so every context starts on whichever environment in the
// default list matches its name.
const defaultConfig: Config = {
    colorMode: "system",
    timestampMode: "age",
    contextEnvironments: {},
    environments: DEFAULT_ENVIRONMENTS,
};

function loadConfig(): Config {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const stored = JSON.parse(raw);
            const merged = { ...defaultConfig, ...stored };
            // The environment list is validated rather than trusted: an entry written before
            // the list existed has none (so the defaults stand), and a malformed one falls
            // back to the defaults instead of breaking every page that groups contexts. A
            // stored empty array survives, because that is how a cleared list persists.
            return { ...merged, environments: normalizeEnvironments(stored?.environments) };
        }
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
    compiledEnvironments: compileEnvironments(defaultConfig.environments),
    resolvedColorMode: "light",
    setColorMode: () => {},
    setTimestampMode: () => {},
    setContextEnvironment: () => {},
    setEnvironments: () => {},
});

export function ConfigProvider({ children }: { children: ReactNode }) {
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [config, setConfig] = useState<Config>(loadConfig);

    const resolvedColorMode: "light" | "dark" =
        config.colorMode === "system" ? (prefersDark ? "dark" : "light") : config.colorMode;

    // Compiled once per change to the list, then shared by every surface that groups
    // contexts, so a kubeconfig with many contexts does not recompile the same expressions
    // on every render.
    const compiledEnvironments = useMemo(() => compileEnvironments(config.environments), [config.environments]);

    const value: ConfigContextValue = {
        config,
        compiledEnvironments,
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
        // context falls back to whichever environment matches its name. Stored in the same
        // `karse-config` entry as the other UI settings, so a label survives a reload and an
        // app restart. A cleared label is deleted rather than blanked, so nothing distinguishes
        // "never labelled" from "label removed".
        setContextEnvironment: (context, environmentId) => {
            const contextEnvironments = { ...config.contextEnvironments };
            if (environmentId === null) {
                delete contextEnvironments[context];
            }
            else {
                contextEnvironments[context] = environmentId;
            }
            const next = { ...config, contextEnvironments };
            setConfig(next);
            saveConfig(next);
        },
        // Replaces the whole environment list, which is how the Config page's environments
        // tab saves an add, an edit, a delete, a reorder, a clear and a reset alike. Stored in
        // the same `karse-config` entry, beside the labels, so there is no second storage key.
        setEnvironments: (environments) => {
            const next = { ...config, environments };
            setConfig(next);
            saveConfig(next);
        },
    };

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
    return useContext(ConfigContext);
}
