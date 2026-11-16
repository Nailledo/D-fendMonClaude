/** Icônes SVG dessinées à la main (aucune image externe). */
const s = (body: string, vb = '0 0 24 24') => `<svg class="icon" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const ICON = {
  coin: s('<circle cx="12" cy="12" r="9" fill="#f2c14e" stroke="#8a5a0b" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c98a14" stroke-width="1.6"/><path d="M10 9.5h4M10 14.5h4" stroke="#8a5a0b" stroke-width="1.6" stroke-linecap="round"/>'),
  heart: s('<path d="M12 21s-8-5.3-8-11.2C4 6.6 6.3 4.5 9 4.5c1.4 0 2.4.7 3 1.6.6-.9 1.6-1.6 3-1.6 2.7 0 5 2.1 5 5.3C20 15.7 12 21 12 21z" fill="#e53935" stroke="#7f1d1d" stroke-width="1.8"/><path d="M8 8.5c.5-1 1.3-1.4 2-1.4" stroke="#ffcdd2" stroke-width="1.6" stroke-linecap="round" fill="none"/>'),
  skull: s('<path d="M12 3c-4.4 0-8 3.2-8 7.5 0 2.6 1.3 4.4 3 5.4V19h10v-3.1c1.7-1 3-2.8 3-5.4C20 6.2 16.4 3 12 3z" fill="#efe6d4" stroke="#3a2a1a" stroke-width="1.8"/><circle cx="9" cy="11" r="2" fill="#3a2a1a"/><circle cx="15" cy="11" r="2" fill="#3a2a1a"/><path d="M10 19v-2M14 19v-2M12 15l-1 1.5h2z" stroke="#3a2a1a" stroke-width="1.4" fill="#3a2a1a"/>'),
  horn: s('<path d="M3 14c6-1 10-4 14-9l2 1-1 13-2 1c-3-3-7-4-13-4z" fill="#d7a35c" stroke="#5a3a22" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 14v3h3" fill="none" stroke="#5a3a22" stroke-width="1.8"/><path d="M13 9l1 7" stroke="#8a5a2b" stroke-width="1.4"/>'),
  bow: s('<path d="M6 3c8 3 10 15 0 18" fill="none" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3v18" stroke="#eee" stroke-width="1"/><path d="M4 12h15" stroke="#5d4037" stroke-width="1.8"/><path d="M19 12l-3-2v4z" fill="#cfd8dc" stroke="#455a64" stroke-width="1"/>'),
  shield: s('<path d="M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z" fill="#b23a2a" stroke="#4a1410" stroke-width="1.8"/><path d="M12 6v12M7 11h10" stroke="#f2c14e" stroke-width="2"/>'),
  orb: s('<path d="M5 20h14l-3-4H8z" fill="#5c4a73" stroke="#2a1e3a" stroke-width="1.6"/><circle cx="12" cy="10" r="6" fill="#b388ff" stroke="#4a148c" stroke-width="1.8"/><circle cx="10" cy="8" r="1.8" fill="#ede7f6"/>'),
  cannon: s('<path d="M3 15l11-7 3 4-11 7z" fill="#546e7a" stroke="#263238" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9" cy="18" r="3" fill="#8d6e63" stroke="#3e2723" stroke-width="1.6"/><circle cx="19" cy="7" r="2" fill="#263238"/>'),
  up: s('<path d="M12 3l7 8h-4v9H9v-9H5z" fill="#7bd36b" stroke="#1f5a16" stroke-width="1.8" stroke-linejoin="round"/>'),
  sell: s('<circle cx="12" cy="12" r="8.5" fill="#f2c14e" stroke="#8a5a0b" stroke-width="2"/><path d="M8 12h8" stroke="#8a5a0b" stroke-width="2.6" stroke-linecap="round"/>'),
  flag: s('<path d="M6 21V3" stroke="#5d4037" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="#f2c14e" stroke="#8a5a0b" stroke-width="1.6" stroke-linejoin="round"/>'),
  meteor: s('<path d="M3 3l9 9M7 2l7 7M2 8l7 6" stroke="#ff8f00" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="5.5" fill="#6d4c41" stroke="#3e2723" stroke-width="1.6"/><circle cx="14.5" cy="14.5" r="1.4" fill="#ffb74d"/>'),
  helmet: s('<path d="M4 15c0-6 3.6-10 8-10s8 4 8 10v3H4z" fill="#b0bec5" stroke="#37474f" stroke-width="1.8"/><path d="M12 5v13M7 12h3M14 12h3" stroke="#37474f" stroke-width="1.6"/><path d="M12 5c1-2 3-2 4-1" stroke="#e53935" stroke-width="2" fill="none"/>'),
  pause: s('<rect x="6" y="5" width="4" height="14" rx="1" fill="#fff7e6"/><rect x="14" y="5" width="4" height="14" rx="1" fill="#fff7e6"/>'),
  play: s('<path d="M7 5l12 7-12 7z" fill="#fff7e6"/>'),
  fast: s('<path d="M3 6l8 6-8 6zM12 6l8 6-8 6z" fill="#fff7e6"/>'),
  gear: s('<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="none" stroke="#fff7e6" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="#fff7e6" stroke-width="2.2" stroke-linecap="round"/>'),
  book: s('<path d="M4 4h7c1 0 1 1 1 2v14c0-1-1-2-2-2H4zM20 4h-7c-1 0-1 1-1 2v14c0-1 1-2 2-2h6z" fill="#e6cf9c" stroke="#5a3a22" stroke-width="1.8" stroke-linejoin="round"/>'),
  trophy: s('<path d="M7 4h10v5a5 5 0 01-10 0z" fill="#f2c14e" stroke="#8a5a0b" stroke-width="1.8"/><path d="M7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5" fill="none" stroke="#8a5a0b" stroke-width="1.6"/><path d="M12 14v4M8 20h8" stroke="#8a5a0b" stroke-width="2.2" stroke-linecap="round"/>'),
  star: s('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="#f2c14e" stroke="#8a5a0b" stroke-width="1.5" stroke-linejoin="round"/>'),
  starEmpty: s('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="rgba(0,0,0,0.25)" stroke="#8a5a0b" stroke-width="1.5" stroke-linejoin="round"/>'),
  gift: s('<rect x="4" y="9" width="16" height="11" rx="1.5" fill="#e53935" stroke="#7f1d1d" stroke-width="1.6"/><rect x="3" y="7" width="18" height="4" rx="1" fill="#ef5350" stroke="#7f1d1d" stroke-width="1.6"/><path d="M12 7v13" stroke="#f2c14e" stroke-width="2.4"/><path d="M12 7c-2-4-6-3-4 0M12 7c2-4 6-3 4 0" fill="none" stroke="#f2c14e" stroke-width="1.8"/>'),
  lock: s('<rect x="5" y="10" width="14" height="10" rx="2" fill="#8d6e63" stroke="#3e2723" stroke-width="1.8"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="#3e2723" stroke-width="2"/>'),
  chat: s('<path d="M4 5h16v10H9l-5 4z" fill="#fff7e6" stroke="#3a2414" stroke-width="1.6" stroke-linejoin="round"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  crown: s('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="#f2c14e" stroke="#8a5a0b" stroke-width="1.6" stroke-linejoin="round"/>'),
  boot: s('<path d="M7 3h6v9l6 3v5H5v-4l2-1z" fill="#8d6e63" stroke="#3e2723" stroke-width="1.6" stroke-linejoin="round"/>'),
  users: s('<circle cx="9" cy="8" r="3.5" fill="#fff7e6"/><path d="M2.5 20c.5-4 3.3-6 6.5-6s6 2 6.5 6z" fill="#fff7e6"/><circle cx="17" cy="9" r="2.8" fill="#e6cf9c"/><path d="M15 14.4c3.2-.6 6 1.2 6.5 5.6h-4.5" fill="#e6cf9c"/>'),
};

export const FAMILY_ICON = [ICON.bow, ICON.shield, ICON.orb, ICON.cannon];
export const FAMILY_NAME = ['Archers', 'Caserne', 'Mages', 'Artillerie'];
