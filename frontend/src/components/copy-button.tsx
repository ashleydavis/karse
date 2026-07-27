import { useState } from "react";
import type { MouseEvent } from "react";
import type { SxProps, Theme } from "@mui/material";
import { IconButton, Tooltip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";
import { copyToClipboard } from "../lib/clipboard";

// The shared copy-to-clipboard button used beside any value the user is likely to
// paste into a terminal (a pod name, a node name, an IP, an image, a command, a
// block of YAML).
//
// `text` is the exact string put on the clipboard and `label` names what is being
// copied, so the button's accessible name reads "copy pod name". After a click the
// icon flips to a tick for 1.5 seconds and the tooltip reads "Copied", which is the
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
    const [copied, setCopied] = useState(false);

    // Copies the value and briefly shows the confirmation state.
    async function onCopy(event: MouseEvent<HTMLButtonElement>): Promise<void> {
        event.stopPropagation();
        await copyToClipboard(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
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
