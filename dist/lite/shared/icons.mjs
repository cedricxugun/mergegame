// Inline UI icons (stroke style, inherits currentColor unless filled).
const wrap = (body, vb = '0 0 24 24', extra = '') => `<svg viewBox="${vb}" aria-hidden="true" ${extra}>${body}</svg>`;
const line = body => wrap(body, '0 0 24 24', 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"');

export const icon = {
  energy: wrap('<path d="M13.6 1.8 4.4 13.4h6.1l-1.6 8.8 9.7-12.4h-6.3z" fill="#ffd23f" stroke="#c98a12" stroke-width="1.6" stroke-linejoin="round"/><path d="M12.4 4.6 7.7 11h2.8" fill="none" stroke="#fff6c4" stroke-width="1.4" stroke-linecap="round"/>'),
  star: wrap('<path d="m12 2.4 2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17l-5.8 3.2 1.2-6.5-4.8-4.5 6.5-.8z" fill="#ffcf3d" stroke="#c48a1a" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.6 8.6 12 5.2" stroke="#fff3bd" stroke-width="1.5" stroke-linecap="round"/>'),
  lamp: wrap('<path d="M8 6h8l1 3v8a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9z" fill="#ffe38a" stroke="#a5671d" stroke-width="1.6"/><path d="M10 3h4v3h-4zM9 9h6" stroke="#a5671d" stroke-width="1.6" fill="none"/><circle cx="12" cy="14" r="2.6" fill="#ff9d2e"/>'),
  bag: line('<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  gear: line('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 6.5l2.2 1.6M17.6 15.9l2.2 1.6M4.2 17.5l2.2-1.6M17.6 8.1l2.2-1.6M2.5 12h3M18.5 12h3"/>'),
  sound: line('<path d="m11 4-6 5H2v6h3l6 5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  mute: line('<path d="m11 4-6 5H2v6h3l6 5z"/><path d="m16 9 5 6M21 9l-5 6"/>'),
  check: wrap('<circle cx="12" cy="12" r="10" fill="#4fbf4a" stroke="#fff" stroke-width="2"/><path d="m7.5 12.3 3 3 6-6.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  lock: line('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  back: line('<path d="m14 5-7 7 7 7M7 12h13"/>'),
  book: line('<path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h12M8 8h7"/>'),
  hint: line('<path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 .8-1 2-1 2H9s0-1.2-1-2Z"/>'),
  map: line('<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  hand: wrap('<path d="M9 2.8a1.8 1.8 0 0 1 3.6 0v7.6l.6-.1a1.8 1.8 0 0 1 3.4.9 1.8 1.8 0 0 1 3 1.3v4.2c0 3.5-2.6 6.3-6.3 6.3h-1.2a6 6 0 0 1-4.9-2.6L3.6 15a1.9 1.9 0 0 1 2.9-2.4L9 15z" fill="#fff" stroke="#3b4a3f" stroke-width="1.5" stroke-linejoin="round"/>'),
  close: line('<path d="m6 6 12 12M18 6 6 18"/>'),
  crate: wrap('<rect x="3" y="7" width="18" height="13" rx="2" fill="#d79a52" stroke="#7a4a1d" stroke-width="1.6"/><path d="M3 11h18M9 7v13M15 7v13" stroke="#7a4a1d" stroke-width="1.4"/><path d="M5 4h14l2 3H3z" fill="#e9b673" stroke="#7a4a1d" stroke-width="1.6" stroke-linejoin="round"/>')
};
