import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import "./index.css";
import "./lib/font-awesome";
import { queryClient } from "./lib/query-client";
import { KubeContextProvider } from "./lib/kube-context";
import { KubeNamespaceProvider } from "./lib/kube-namespace";
import { App } from "./app";

const theme = createTheme();
const root = document.getElementById("root")!;

createRoot(root).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <KubeContextProvider>
                <KubeNamespaceProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <App />
                    </ThemeProvider>
                </KubeNamespaceProvider>
            </KubeContextProvider>
        </QueryClientProvider>
    </StrictMode>
);
