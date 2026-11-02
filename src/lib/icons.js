/**
 * Line icons: 24px grid, 1.8 stroke, round caps (the design system's Icons group).
 * They replace the emoji the dock, tray and pings used to show.
 */
const PATHS = {
  incense: '<path d="M9 20V9M12 20V7M15 20V9"/><path d="M12 4.5c-1-1 .8-2-.2-3"/><path d="M5 20h14"/>',
  bowl: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M9 19.5h6"/><path d="M16.5 4.5l3-1.5M18 8l3-.5"/>',
  bow: '<circle cx="15" cy="6" r="2"/><path d="M13.5 8.5L9 12l-3 0"/><path d="M9 12l2 4h5l1 4"/><path d="M4 20h16"/>',
  offering: '<path d="M4 12h16a8 8 0 0 1-16 0z"/><path d="M9 8c0-1.5 1-1.5 1-3M14 8c0-1.5 1-1.5 1-3"/><path d="M15 3.5l5 4"/>',
  breathe: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 3"/><path d="M12 2v1.5M12 20.5V22"/>',
  lantern: '<path d="M10 3h4M12 3v2"/><path d="M8 7.5C8 6 9.5 5 12 5s4 1 4 2.5v7c0 1.5-1.5 2.5-4 2.5s-4-1-4-2.5z"/><path d="M8 11h8"/><path d="M11 17v2h2v-2M12 19v2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
  fire: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3 2-4.6 2.6-7.2.3 1.2.9 2 1.9 2.6C10.3 7.5 11.2 5 13.6 3c-.4 2.6.9 4.2 2.4 5.8 1.4 1.5 2.5 3 2.5 6.2 0 3.4-2.5 6-6.5 6z"/>',
  slip: '<path d="M8 3h8l-1 18H9z"/><path d="M10 8h4M10 11.5h4M10 15h3"/>',
  chorus: '<path d="M4 20h16"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><path d="M5 17l2-6 2 6M15 17l2-6 2 6"/>',
  check: '<path d="M5 12l4 4L19 6"/>',
};

export function icon(name, cls = 'ico') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}
