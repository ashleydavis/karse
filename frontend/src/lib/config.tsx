import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useMediaQuery } from "@mui/material";

const STORAGE_KEY = "karse-config";

type ColorMode = "light" | "dark" | "system";

type Config = {
    colorMode: ColorMode;
};

type ConfigContextValue = {
    config: Config;
    resolvedColorMode: "light" | "dark";
    setColorMode: (mode: ColorMode) => void;
};

const defaultConfig: Config = { colorMode: "system" };

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
    }), [config, resolvedColorMode]);

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
    return useContext(ConfigContext);
}
