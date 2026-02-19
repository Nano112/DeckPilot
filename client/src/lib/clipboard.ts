/**
 * Copy text to clipboard with fallback for non-secure contexts (HTTP over LAN).
 * navigator.clipboard is completely undefined on HTTP in many browsers.
 * The fallback uses a temporary textarea + execCommand('copy').
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first — wrapped defensively since clipboard can be undefined
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[Clipboard] Modern API failed:", err);
  }

  // Legacy fallback — works in non-secure contexts
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Needs to be visible enough for execCommand to work on some browsers
    textarea.style.position = "fixed";
    textarea.style.left = "0";
    textarea.style.top = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    textarea.style.opacity = "0.01";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (ok) return true;
  } catch (err) {
    console.warn("[Clipboard] Legacy fallback failed:", err);
  }

  return false;
}
