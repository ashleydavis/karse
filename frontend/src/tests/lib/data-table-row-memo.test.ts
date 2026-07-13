import { dataTableRowPropsEqual, type DataTableRowProps } from "../../lib/data-table-row-memo";

// A stand-in for a TanStack row. Only identity matters to the comparison, so the shape is
// whatever a row of a Karse table carries.
function makeRow(name: string): any {
    return {
        id: name,
        original: {
            name,
        },
    };
}

// A stand-in for a TanStack cell. Again only identity matters to the comparison.
function makeCell(id: string): any {
    return {
        id,
    };
}

// Builds the props of one rendered row, as a table hands them to the memoised row component.
function makeProps(overrides: Partial<DataTableRowProps<any>> = {}): DataTableRowProps<any> {
    const row = makeRow("nginx-web-00001");
    return {
        row,
        cells: [makeCell("name"), makeCell("namespace"), makeCell("phase")],
        testId: "pod-row",
        clickable: true,
        onOpen: () => {},
        ...overrides,
    };
}

describe("dataTableRowPropsEqual", () => {
    // The point of the whole fix: typing in the search box changes which rows match, but not
    // the rows themselves, so a surviving row must be able to skip its re-render.
    test("says an unchanged row need not re-render", () => {
        const props = makeProps();
        const next: DataTableRowProps<any> = {
            ...props,
        };
        expect(dataTableRowPropsEqual(props, next)).toBe(true);
    });

    // TanStack rebuilds the array holding a row's cells whenever a table hands it a fresh
    // column-visibility object, but the cells inside it are the same objects. That must not
    // count as a change, or every row would re-render on every keystroke again.
    test("says a row whose cells are unchanged need not re-render, even in a new array", () => {
        const props = makeProps();
        const next = makeProps({
            row: props.row,
            cells: [...props.cells],
            onOpen: props.onOpen,
        });
        expect(dataTableRowPropsEqual(props, next)).toBe(true);
    });

    test("re-renders a row whose data changed", () => {
        const props = makeProps();
        const next = makeProps({
            row: makeRow("nginx-web-00002"),
            cells: props.cells,
            onOpen: props.onOpen,
        });
        expect(dataTableRowPropsEqual(props, next)).toBe(false);
    });

    // New column definitions (a changed view mode, a fresh usage snapshot, a reordered or
    // newly hidden column) give the row new cells, and the row must re-render to show them.
    test("re-renders a row whose cells changed", () => {
        const props = makeProps();
        const next = makeProps({
            row: props.row,
            cells: [props.cells[0], makeCell("namespace"), props.cells[2]],
            onOpen: props.onOpen,
        });
        expect(dataTableRowPropsEqual(props, next)).toBe(false);
    });

    test("re-renders a row that gained or lost a column", () => {
        const props = makeProps();
        const next = makeProps({
            row: props.row,
            cells: props.cells.slice(0, 2),
            onOpen: props.onOpen,
        });
        expect(dataTableRowPropsEqual(props, next)).toBe(false);
    });

    test("re-renders a row whose click behaviour changed", () => {
        const props = makeProps();
        expect(dataTableRowPropsEqual(props, makeProps({
            row: props.row,
            cells: props.cells,
            onOpen: props.onOpen,
            clickable: false,
        }))).toBe(false);
        expect(dataTableRowPropsEqual(props, makeProps({
            row: props.row,
            cells: props.cells,
            onOpen: () => {},
        }))).toBe(false);
    });
});
