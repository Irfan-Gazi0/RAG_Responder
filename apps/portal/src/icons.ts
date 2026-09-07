// Lucide icons (github.com/lucide-icons/lucide, ISC license) — inline SVG paths,
// stroke="currentColor" so each one inherits whatever colour wraps it. Same
// approach as `_ICON_PATHS` in streamlit_app.py and the inline icons in
// apps/v1/chat_panel.html, so the whole portal reads as one icon set.
//
// DOM chrome only. The in-VR HUD is UIKit text with a font atlas that has no
// glyphs for these (or for emoji) — HUD labels stay plain ASCII.
const PATHS: Record<string, string> = {
  truck:
    '<path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2"/>' +
    '<path d="M15 18H9"/>' +
    '<path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>' +
    '<circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause:
    '<rect x="14" y="4" width="4" height="16" rx="1"/>' +
    '<rect x="6" y="4" width="4" height="16" rx="1"/>',
  "volume-x":
    '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>' +
    '<line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  "volume-2":
    '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>' +
    '<path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  glasses:
    '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/>' +
    '<path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>' +
    '<path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>',
  "log-out":
    '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>' +
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  "triangle-alert":
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
};

export type IconName = keyof typeof PATHS;

/** Inline Lucide SVG markup, sized by the `.icon` rule in index.html. */
export function icon(name: IconName): string {
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    PATHS[name] +
    "</svg>"
  );
}

/**
 * Fill the shared #error-banner with an alert icon plus `msg`.
 * `append()` (not innerHTML) keeps the message text inert — it can carry a
 * fetch error string straight from the network layer.
 */
export function setErrorBanner(el: HTMLElement, msg: string) {
  el.innerHTML = icon("triangle-alert");
  el.append(msg);
}
