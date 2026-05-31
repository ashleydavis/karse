import type { SxProps, Theme } from "@mui/material";

// Consistent hover rule for all data tables across Karse:
//   - Every data row (clickable or static) gets the same MUI "action.hover"
//     background highlight on hover so the UX is uniform everywhere.
//   - Clickable rows that navigate to a detail page additionally show a
//     pointer cursor to advertise the affordance; static rows keep the
//     default cursor.
// Pass clickable=true for rows wired to an onClick navigation handler.
export function tableRowSx(clickable: boolean): SxProps<Theme> {
    return {
        cursor: clickable ? "pointer" : "default",
        "&:hover": {
            bgcolor: "action.hover",
        },
    };
}
