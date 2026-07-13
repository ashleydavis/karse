import type { SxProps, Theme } from "@mui/material";

// The translucent tint every table header cell is painted with, over the table's paper
// background. Single source of truth: the MuiTableHead theme override in main.tsx applies it
// to every head cell, and the pinned actions column (lib/sticky-actions.ts) composites the
// same tint over an opaque base so the pinned header cell matches the rest of the header row.
export function tableHeadCellTint(theme: Theme): string {
    return theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)";
}

// The row style for a row that navigates to a detail page on click.
const CLICKABLE_ROW_SX: SxProps<Theme> = {
    cursor: "pointer",
    "&:hover": {
        bgcolor: "action.hover",
    },
};

// The row style for a static row, which highlights on hover but does not navigate.
const STATIC_ROW_SX: SxProps<Theme> = {
    cursor: "default",
    "&:hover": {
        bgcolor: "action.hover",
    },
};

// Consistent hover rule for all data tables across Karse:
//   - Every data row (clickable or static) gets the same MUI "action.hover"
//     background highlight on hover so the UX is uniform everywhere.
//   - Clickable rows that navigate to a detail page additionally show a
//     pointer cursor to advertise the affordance; static rows keep the
//     default cursor.
// Pass clickable=true for rows wired to an onClick navigation handler.
// Both styles are constants rather than fresh objects so a re-rendered row hands MUI the same
// sx it had before, and emotion does not re-evaluate an identical style for every cell.
export function tableRowSx(clickable: boolean): SxProps<Theme> {
    return clickable ? CLICKABLE_ROW_SX : STATIC_ROW_SX;
}
