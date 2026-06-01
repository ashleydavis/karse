import { useState } from "react";
import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText, Divider, Tooltip, IconButton } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconName } from "@fortawesome/fontawesome-svg-core";
import { Link, useLocation } from "react-router-dom";
import { useShareableTo } from "../lib/nav-state";

const NAV_ITEMS = [
    { to: "/contexts",     icon: "link"         as const, label: "Contexts"     },
    { to: "/cluster",      icon: "dharmachakra" as const, label: "Cluster"      },
    { to: "/nodes",        icon: "server"       as const, label: "Nodes"        },
    { to: "/namespaces",   icon: "layer-group"  as const, label: "Namespaces"   },
    { to: "/pods",         icon: "cube"         as const, label: "Pods"         },
    { to: "/deployments",  icon: "cubes"        as const, label: "Deployments"  },
    { to: "/statefulsets", icon: "database"     as const, label: "StatefulSets" },
    { to: "/daemonsets",   icon: "sitemap"      as const, label: "DaemonSets"   },
    { to: "/events",       icon: "bell"         as const, label: "Events"       },
    { to: "/logs",         icon: "stream"       as const, label: "Live Logs"    },
    { to: "/stern",        icon: "tower-broadcast" as const, label: "Stern"      },
];

// Nav items pinned to the bottom of the sidebar, visually separated from the
// main navigation above. Currently just the cluster-wide Errors page.
const BOTTOM_NAV_ITEMS = [
    { to: "/errors", icon: "circle-exclamation" as const, label: "Errors" },
];

export function Sidebar() {
    const { pathname } = useLocation();
    const buildTo = useShareableTo();
    const [collapsed, setCollapsed] = useState(false);

    // Renders a single sidebar nav item (link with icon and label). Shared between
    // the main nav list and the bottom-pinned nav list.
    function renderNavItem({ to, icon, label }: { to: string; icon: IconName; label: string }) {
        const active = pathname === to || pathname.startsWith(to + "/");
        return (
            <Tooltip key={to} title={collapsed ? label : ""} placement="right">
                <ListItemButton
                    component={Link}
                    to={buildTo(to)}
                    selected={active}
                    aria-label={label.toLowerCase()}
                    sx={{
                        borderRadius: 1.5,
                        mb: 0.25,
                        py: 0.75,
                        justifyContent: collapsed ? "center" : "flex-start",
                        "& .MuiListItemIcon-root": {
                            color: active ? "primary.main" : "text.secondary",
                            transition: "color 0.15s",
                        },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: collapsed ? 0 : 32 }}>
                        <FontAwesomeIcon icon={["fas", icon]} />
                    </ListItemIcon>
                    {!collapsed && (
                        <ListItemText
                            primary={label}
                            slotProps={{
                                primary: {
                                    sx: { fontSize: "0.875rem", fontWeight: active ? 600 : 400 },
                                },
                            }}
                        />
                    )}
                </ListItemButton>
            </Tooltip>
        );
    }

    return (
        <Box
            component="nav"
            sx={{
                width: collapsed ? 56 : 200,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                height: "100vh",
                transition: "width 0.2s ease",
                overflow: "hidden",
            }}
        >
            <Box sx={{ px: collapsed ? 0 : 2.5, height: 48, display: "flex", alignItems: "center", gap: 1.5, justifyContent: collapsed ? "center" : "flex-start" }}>
                <Box sx={{ color: "primary.main", flexShrink: 0 }}>
                    <FontAwesomeIcon icon={["fas", "dharmachakra"]} />
                </Box>
                {!collapsed && (
                    <Typography
                        variant="subtitle1"
                        component={Link}
                        to={buildTo("/")}
                        data-test-id="karse-title"
                        sx={{ fontWeight: 700, textDecoration: "none", color: "inherit", letterSpacing: "-0.02em" }}
                    >
                        Karse
                    </Typography>
                )}
            </Box>

            <Divider />

            <List sx={{ flex: 1, pt: 1, px: 0.75 }} disablePadding>
                {NAV_ITEMS.map((item) => renderNavItem(item))}
            </List>

            <Divider />

            <List sx={{ py: 0.5, px: 0.75 }} disablePadding data-test-id="sidebar-bottom-nav">
                {BOTTOM_NAV_ITEMS.map((item) => renderNavItem(item))}
            </List>

            <Divider />

            <Box sx={{ p: 0.5, display: "flex", justifyContent: collapsed ? "center" : "flex-end" }}>
                <IconButton
                    size="small"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
                >
                    <FontAwesomeIcon icon={["fas", collapsed ? "chevron-right" : "chevron-left"]} />
                </IconButton>
            </Box>
        </Box>
    );
}
