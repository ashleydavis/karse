import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material";
import { IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown, faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { copyToClipboard } from "../lib/clipboard";
import { useKubeContext } from "../lib/kube-context";

// How long the tick stays up after a copy, in milliseconds. Long enough to read,
// short enough that the button is back to its resting icon before the user looks again.
const CONFIRMATION_MS = 1500;

// The confirmation half of every copy control: puts the text on the clipboard and
// holds a "copied" flag up for a moment afterwards. Both the plain button and the
// menu button share it, so a copy looks the same however it was started.
function useCopyConfirmation(): { copied: boolean; copy: (text: string) => Promise<void> } {
    const [copied, setCopied] = useState(false);

    // Copies the value and briefly raises the confirmation state.
    async function copy(text: string): Promise<void> {
        await copyToClipboard(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), CONFIRMATION_MS);
    }

    return { copied, copy };
}

// The shared copy-to-clipboard button used beside any single-form value the user is
// likely to paste into a terminal (a Pod IP, a container image, an event reason, a
// command, a block of YAML). A value with more than one useful form uses
// CopyNameButton below instead, so the user never opens a menu with nothing to choose
// between.
//
// `text` is the exact string put on the clipboard and `label` names what is being
// copied, so the button's accessible name reads "copy pod IP". After a click the
// icon flips to a tick for a moment and the tooltip reads "Copied", which is the
// confirmation pattern the app already used for commands, YAML, and the share link.
//
// The click is stopped from reaching an ancestor, because these buttons sit inside
// clickable table rows that would otherwise navigate to a detail page on the way to
// the clipboard.
//
// The button is wrapped in a span inside the tooltip so the tooltip still opens
// while the button is disabled (a disabled MUI button fires no pointer events).
export function CopyButton({ text, label, testId, tooltip = "Copy", disabled = false, sx }: {
    text: string;
    label: string;
    testId: string;
    tooltip?: string;
    disabled?: boolean;
    sx?: SxProps<Theme>;
}) {
    const { copied, copy } = useCopyConfirmation();

    // Copies the value, keeping the click away from any clickable ancestor.
    async function onCopy(event: MouseEvent<HTMLButtonElement>): Promise<void> {
        event.stopPropagation();
        await copy(text);
    }

    return (
        <Tooltip title={copied ? "Copied" : tooltip}>
            <span style={{ display: "inline-flex" }}>
                <IconButton
                    size="small"
                    onClick={onCopy}
                    disabled={disabled}
                    aria-label={`copy ${label}`}
                    data-test-id={testId}
                    sx={sx}
                >
                    <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                </IconButton>
            </span>
        </Tooltip>
    );
}

// The two forms a resource name can be copied in, shortest first, so a fast click on
// the first entry gets the bare name.
//
// `short` is the resource's own name on its own. `long` is the full slash path from the
// kubeconfig context down: "kind-karse/default/nginx-abc" for a namespaced resource,
// "kind-karse/node-1" for a cluster-scoped one, and "kind-karse/default/nginx-abc/nginx"
// for a container, which hangs off its pod.
export function resourceNameForms(context: string | null, segments: string[]): { short: string; long: string } {
    // An absent context, or a blank namespace on a cluster-scoped resource, must not
    // leave an empty path segment in the long form.
    const parts = [context ?? "", ...segments].filter((part) => part !== "");
    return {
        short: segments[segments.length - 1] ?? "",
        long: parts.join("/"),
    };
}

// The menu variant of the shared copy button, for a value that is a resource name and
// so has two useful forms. Clicking it opens a two-entry menu, short then long, and
// choosing an entry copies that form with the same tick-and-tooltip confirmation the
// plain button gives.
//
// `segments` is the resource's path below the context, so a pod passes
// [namespace, name], a node or namespace passes [name], and a container passes
// [namespace, podName, containerName]. Everything above that comes from the active
// kubeconfig context, which is app-wide, so no caller needs to know the resource kind.
//
// Each entry is labelled by its form and shows the exact text it will copy, so the user
// picks by seeing the result rather than by decoding a label.
//
// It renders a copy icon with a caret beside it, so it reads as a drop-down at a glance
// and is never mistaken for the plain one-click CopyButton. The caret is the only visual
// difference between the two controls, and it is what tells the user there is a choice
// of forms behind this one.
//
// Every click here (opening the menu, choosing an entry, dismissing it) is stopped from
// reaching an ancestor, because these controls sit in clickable table rows that would
// otherwise navigate to a detail page.
export function CopyNameButton({ segments, label, testId, sx }: {
    segments: string[];
    label: string;
    testId: string;
    sx?: SxProps<Theme>;
}) {
    const { current } = useKubeContext();
    const { copied, copy } = useCopyConfirmation();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const forms = resourceNameForms(current, segments);

    // Opens the menu without letting the click reach a clickable ancestor row.
    function onOpen(event: MouseEvent<HTMLButtonElement>): void {
        event.stopPropagation();
        setAnchor(event.currentTarget);
    }

    // Dismisses the menu without letting the click reach a clickable ancestor row.
    function onClose(event: {}): void {
        (event as MouseEvent).stopPropagation?.();
        setAnchor(null);
    }

    // Copies the chosen form and closes the menu.
    async function onChoose(event: MouseEvent<HTMLLIElement>, text: string): Promise<void> {
        event.stopPropagation();
        setAnchor(null);
        await copy(text);
    }

    return (
        <>
            <Tooltip title={copied ? "Copied" : "Copy name: short or full path"}>
                <span style={{ display: "inline-flex" }}>
                    <IconButton
                        size="small"
                        onClick={onOpen}
                        aria-label={`copy ${label}`}
                        aria-haspopup="menu"
                        data-test-id={testId}
                        sx={sx}
                    >
                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                        <FontAwesomeIcon icon={faCaretDown} style={{ marginLeft: 2, fontSize: "0.7em" }} />
                    </IconButton>
                </span>
            </Tooltip>
            <Menu
                anchorEl={anchor}
                open={anchor !== null}
                onClose={onClose}
                onClick={(event) => event.stopPropagation()}
                data-test-id={`${testId}-menu`}
            >
                <CopyFormItem
                    form="Short name"
                    text={forms.short}
                    testId={`${testId}-short`}
                    onChoose={onChoose}
                />
                <CopyFormItem
                    form="Full path"
                    text={forms.long}
                    testId={`${testId}-long`}
                    onChoose={onChoose}
                />
            </Menu>
        </>
    );
}

// One entry of the copy menu: the name of the form above, and the exact text that
// choosing it puts on the clipboard below, in monospace so it reads as a value.
function CopyFormItem({ form, text, testId, onChoose }: {
    form: string;
    text: string;
    testId: string;
    onChoose: (event: MouseEvent<HTMLLIElement>, text: string) => Promise<void>;
}) {
    return (
        <MenuItem onClick={(event) => void onChoose(event, text)} data-test-id={testId}>
            <ListItemText
                primary={form}
                secondary={
                    <Typography component="span" variant="caption" sx={{ fontFamily: "monospace" }}>
                        {text}
                    </Typography>
                }
            />
        </MenuItem>
    );
}

// A resource name as it appears in a table's Name column: the name itself with the copy
// menu beside it. Every resource list renders its name through this, so the control sits
// in the same place and behaves the same way in all of them.
//
// `extra` is anything the table shows alongside the name (the namespace list's "active"
// and "default" chips), rendered between the name and the copy control.
//
// The name itself is wrapped in its own element rather than left as a bare text node, so
// a click on the name is addressable: the row navigates when the name is clicked, and the
// copy control beside it swallows its own clicks, so the two need to be told apart.
export function CopyNameCell({ segments, label, testId, extra }: {
    segments: string[];
    label: string;
    testId: string;
    extra?: ReactNode;
}) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            <span data-test-id={`${testId}-text`}>{segments[segments.length - 1] ?? ""}</span>
            {extra}
            <CopyNameButton segments={segments} label={label} testId={testId} />
        </span>
    );
}
