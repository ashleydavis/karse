import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText, Divider } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
    { to: "/",           icon: "server"      as const, label: "Cluster"    },
    { to: "/namespaces", icon: "layer-group" as const, label: "Namespaces" },
    { to: "/pods",       icon: "cube"        as const, label: "Pods"       },
];

export function Sidebar() {
    const { pathname } = useLocation();

    return (
        <Box
            component="nav"
            sx={{
                width: 200,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                height: "100vh",
            }}
        >
            <Box sx={{ px: 2.5, py: 2.25, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ color: "primary.main" }}>
                    <FontAwesomeIcon icon={["fas", "dharmachakra"]} />
                </Box>
                <Typography
                    variant="subtitle1"
                    component={Link}
                    to="/"
                    sx={{ fontWeight: 700, textDecoration: "none", color: "inherit", letterSpacing: "-0.02em" }}
                >
                    Karse
                </Typography>
            </Box>

            <Divider />

            <List sx={{ flex: 1, pt: 1, px: 0.75 }} disablePadding>
                {NAV_ITEMS.map(({ to, icon, label }) => {
                    const active = pathname === to;
                    return (
                        <ListItemButton
                            key={to}
                            component={Link}
                            to={to}
                            selected={active}
                            sx={{
                                borderRadius: 1.5,
                                mb: 0.25,
                                py: 0.75,
                                "& .MuiListItemIcon-root": {
                                    color: active ? "primary.main" : "text.secondary",
                                    transition: "color 0.15s",
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <FontAwesomeIcon icon={["fas", icon]} />
                            </ListItemIcon>
                            <ListItemText
                                primary={label}
                                slotProps={{
                                    primary: {
                                        sx: { fontSize: "0.875rem", fontWeight: active ? 600 : 400 },
                                    },
                                }}
                            />
                        </ListItemButton>
                    );
                })}
            </List>
        </Box>
    );
}
