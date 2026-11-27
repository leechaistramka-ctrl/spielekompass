/**
 * Eigene, schlichte Linien-Icons (24×24, selbst gezeichnet – keine Fremdlizenz).
 * Verwendung: icon('tasks') liefert ein <svg> als Text.
 */
const PATHS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.8"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.8"/><rect x="3" y="15" width="7.5" height="6" rx="1.8"/>',
  projects: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  tasks: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12.2 2.8 2.8L16.2 9"/>',
  ideas: '<path d="M9.2 17.5h5.6M10 20.8h4M12 3.2a6 6 0 0 0-3.6 10.8c.7.5 1 1.2 1 2v.4h5.2V16c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.2z"/>',
  journal: '<path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v15H6.8A1.8 1.8 0 0 0 5 19.8zM5 19.8A1.8 1.8 0 0 0 6.8 21.6H19"/><path d="M9 7.5h6M9 11h4"/>',
  prompts: '<path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z"/><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  links: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  data: '<path d="M7.5 4v15M3.5 15l4 4 4-4M16.5 20V5M12.5 9l4-4 4 4"/>',
  settings: '<path d="M4 6.5h9M19 6.5h1M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="16" cy="6.5" r="2.3"/><circle cx="9" cy="12" r="2.3"/><circle cx="17" cy="17.5" r="2.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13 7 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.6 1.6 0 0 0 8.6 21h6.8a1.6 1.6 0 0 0 1.6-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  'chevron-right': '<path d="m9.5 6 6 6-6 6"/>',
  'chevron-left': '<path d="m14.5 6-6 6 6 6"/>',
  'chevron-down': '<path d="m6 9.5 6 6 6-6"/>',
  play: '<rect x="2.5" y="5" width="19" height="14" rx="3.5"/><path d="M10 9v6l5-3z"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="17.5" r=".9"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="17" y="4" width="4" height="7" rx="1.6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V5.8A2.3 2.3 0 0 0 13.2 3.5H5.8A2.3 2.3 0 0 0 3.5 5.8v7.4a2.3 2.3 0 0 0 2.3 2.3h2.7"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 20V9M7.5 13.5 12 9l4.5 4.5M5 4h14"/>',
  share: '<path d="M12 3.5v12M8 7.5l4-4 4 4M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6a1.5 1.5 0 0 0-1.5-1.5H18"/>',
  mountain: '<path d="M2.5 19.5 9 8.5l3.6 5.6 2.6-3.6 6.3 9z"/><path d="m7.4 11.2 1.6-2.7 1.5 2.3"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
  sparkle: '<path d="M12 4l1.6 5 5 1.6-5 1.6L12 17.2l-1.6-5-5-1.6 5-1.6z"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/>',
  star: '<path d="M12 3.6l2.55 5.2 5.75.84-4.15 4.05.98 5.71L12 16.7l-5.13 2.7.98-5.71L3.7 9.64l5.75-.84z"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
  undo: '<path d="M9 8H5V4"/><path d="M5.3 8A8 8 0 1 1 4 12.5"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5 20 4"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.8"/><circle cx="8.3" cy="8.3" r="1.1"/><circle cx="15.7" cy="8.3" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="8.3" cy="15.7" r="1.1"/><circle cx="15.7" cy="15.7" r="1.1"/>',
  camera: '<path d="M3.5 8.5a2 2 0 0 1 2-2h2.3L9.5 4h5l1.7 2.5h2.3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.4 14.1a5.8 5.8 0 0 1 3.4 5.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.2 2"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M5 3.5v4h4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
};

export function icon(name, cls = '') {
  const body = PATHS[name] || PATHS.info;
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
