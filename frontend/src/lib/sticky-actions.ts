import type { Theme, CSSObject } from "@mui/material/styles";
import { tableHeadCellTint } from "./table-row-style";

// A single sticky-column style: either a plain style object or a theme-reading callback.
// Deliberately narrower than MUI's SxProps (which also permits arrays) so a value of this
// type is a legal element of an `sx={[...]}` array when merged with a table cell's own sx.
type StickySx = CSSObject | ((theme: Theme) => CSSObject);

// The stable column id every resource table uses for its actions column. The sticky-pin
// treatment keys off this id, and the column-config machinery treats an actions column as
// non-configurable (appended last), so the actions column is always the rightmost column
// and can be pinned to the right edge. Both the contexts and namespaces tables set their
// action column's id to this constant; any future resource table with an actions column
// should do the same to inherit the pinning for free.
export const ACTIONS_COLUMN_ID = "action";

// The left-edge shadow that signals the pinned actions column floats above the columns that
// scroll underneath it. Darker in dark mode so it stays visible against the darker paper.
function pinShadow(theme: Theme): string {
    const glow = theme.palette.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.28)";
    return `inset 1px 0 0 ${theme.palette.divider}, -8px 0 8px -8px ${glow}`;
}

// sx for the actions column's HEADER cell. Pins it to the right edge of the horizontally
// scrolling TableContainer with an opaque background so the other header cells pass beneath
// it when the table is wider than the window. Returns an empty sx for every other column so
// callers can apply it unconditionally to each header cell.
//
// The rules sit under a `&&&` selector to raise their specificity. The MuiTableHead theme
// override in main.tsx styles head cells through a descendant selector
// (`.MuiTableHead-root .MuiTableCell-head`), which out-specifies a plain sx class: a
// background set here without the boost lost to the theme's translucent tint, leaving the
// pinned header cell see-through so the scrolled-under header text showed through it.
export function stickyActionsHeaderSx(isActionsColumn: boolean): StickySx {
    if (!isActionsColumn) {
        return {};
    }
    return (theme) => ({
        "&&&": {
            position: "sticky",
            right: 0,
            // Above sibling header cells so scrolled columns pass underneath the pinned cell.
            zIndex: 2,
            // Opaque paper base with the head-cell tint composited on top as a gradient layer:
            // the cell renders exactly the colour the rest of the header row does (paper + tint)
            // while being fully opaque, so the columns scrolling under it cannot show through.
            backgroundColor: theme.palette.background.paper,
            backgroundImage: `linear-gradient(${tableHeadCellTint(theme)}, ${tableHeadCellTint(theme)})`,
            boxShadow: pinShadow(theme),
        },
    });
}

// sx for an actions column BODY cell. Pins it to the right edge with an opaque background so
// the scrolled columns pass underneath. The shared row-hover rule (tableRowSx) tints the
// transparent data cells via the <tr> background, which the opaque pinned cell would hide;
// so on hover we composite the same translucent hover colour over the opaque base as a
// gradient layer, keeping the pinned cell in step with the rest of the hovered row while it
// stays fully opaque over scrolled content. Returns an empty sx for every other column.
export function stickyActionsCellSx(isActionsColumn: boolean): StickySx {
    if (!isActionsColumn) {
        return {};
    }
    return (theme) => ({
        position: "sticky",
        right: 0,
        // Above sibling data cells (which stay at the default stacking) so they scroll under it.
        zIndex: 1,
        backgroundColor: theme.palette.background.paper,
        boxShadow: pinShadow(theme),
        "tr:hover &": {
            backgroundImage: `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
        },
    });
}
