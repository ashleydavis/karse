// The one place the frontend writes to the system clipboard. Every copy control in
// the app goes through here so there is a single implementation to reason about.
// The Clipboard API is absent in insecure or unsupported browsing contexts, so the
// call degrades gracefully to doing nothing rather than throwing at the call site.
export async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard)
    {
        await navigator.clipboard.writeText(text);
    }
}
