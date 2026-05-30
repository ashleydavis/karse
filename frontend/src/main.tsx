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
    const dark = resolvedColorMode === "dark";

    const theme = useMemo(() => createTheme({
        palette: {
            mode: resolvedColorMode,
            primary: {
                main: dark ? "#60a5fa" : "#2563eb",
            },
            background: {
                default: dark ? "#0f172a" : "#f1f5f9",
                paper:   dark ? "#1e293b" : "#ffffff",
            },
        },
        shape: { borderRadius: 8 },
        typography: {
            fontFamily: ["system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"].join(","),
        },
        components: {
            MuiAppBar: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    colorDefault: ({ theme }) => ({
                        backgroundColor: theme.palette.background.paper,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }),
                },
            },
            MuiCard: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: ({ theme }) => ({
                        border: `1px solid ${theme.palette.divider}`,
                    }),
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        "& .MuiTableCell-head": {
                            fontWeight: 600,
                            fontSize: "0.7rem",
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.07em",
                            color: theme.palette.text.secondary,
                            backgroundColor: theme.palette.mode === "dark"
                                ? "rgba(255,255,255,0.04)"
                                : "rgba(0,0,0,0.025)",
                        },
                    }),
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        "&:last-child td, &:last-child th": { border: 0 },
                    },
                },
            },
            MuiTableContainer: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: theme.shape.borderRadius,
                    }),
                },
            },
            MuiPaper: {
                defaultProps: { elevation: 0 },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        "&.Mui-selected": {
                            backgroundColor: theme.palette.mode === "dark"
                                ? "rgba(96,165,250,0.12)"
                                : "rgba(37,99,235,0.08)",
                            "&:hover": {
                                backgroundColor: theme.palette.mode === "dark"
                                    ? "rgba(96,165,250,0.18)"
                                    : "rgba(37,99,235,0.12)",
                            },
                        },
                    }),
                },
            },
        },
    }), [resolvedColorMode, dark]);

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
