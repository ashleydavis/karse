import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import "./index.css";
import "./lib/font-awesome";
import { queryClient } from "./lib/query-client";
import { KubeContextProvider } from "./lib/kube-context";
import { KubeNamespaceProvider } from "./lib/kube-namespace";
import { ConfigProvider, useConfig } from "./lib/config";
import { App } from "./app";

function Root() {
    const { resolvedColorMode } = useConfig();
    const theme = useMemo(() => createTheme({ palette: { mode: resolvedColorMode } }), [resolvedColorMode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    );
}

const root = document.getElementById("root")!;

createRoot(root).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <KubeContextProvider>
                <KubeNamespaceProvider>
                    <ConfigProvider>
                        <Root />
                    </ConfigProvider>
                </KubeNamespaceProvider>
            </KubeContextProvider>
        </QueryClientProvider>
    </StrictMode>
);
