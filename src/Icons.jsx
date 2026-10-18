// Icone SVG a linea (stile Lucide), nessuna dipendenza
const mk = (body) => ({ size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{body}</svg>
);

export const I = {
  Home: mk(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>),
  Search: mk(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  Bookmark: mk(<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />),
  Shield: mk(<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>),
  Clock: mk(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  Mask: mk(<><path d="M12 2C8.500 2 6.300 3.300 5.400 5.600L4.200 12c-.1 2 .6 3 1.400 4.600L8 20.600 9.300 22h5.400l1.300-1.400 2.400-4c.8-1.600 1.500-2.600 1.400-4.600l-1.200-6.400C17.700 3.300 15.500 2 12 2Z" /><path d="M6.300 5.500L6.700 8Q9 9.300 12 10.200q3-.9 5.300-2.200l.4-2.500" /><path d="M6.600 11l4.400.3v1.900H6.800zM17.400 11L13 11.300v1.900h4.200z" /><path d="M10.600 11.500L12 14.600l1.400-3.100M10.200 15L12 16.300 13.800 15" /><path d="M8.600 17.300Q12 16.200 15.400 17.300M10.200 18.400V22M13.800 18.400V22" /></>),
  Play: mk(<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />),
  Plus: mk(<><path d="M5 12h14" /><path d="M12 5v14" /></>),
  Check: mk(<path d="M20 6 9 17l-5-5" />),
  Chevron: mk(<path d="m9 18 6-6-6-6" />),
  Film: mk(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18" /><path d="M3 7.5h4" /><path d="M3 12h18" /><path d="M3 16.5h4" /><path d="M17 3v18" /><path d="M17 7.5h4" /><path d="M17 16.5h4" /></>),
  Tv: mk(<><rect width="20" height="15" x="2" y="7" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></>),
  X: mk(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  Trash: mk(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>),
  Pencil: mk(<><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>),
  ArrowUp: mk(<><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>),
  ArrowDown: mk(<><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>),
  Save: mk(<><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></>),
  Eye: mk(<><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>),
  Info: mk(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>),
  Flag: mk(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></>),
  Send: mk(<><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></>),
  Folder: mk(<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />),
  Chart: mk(<><path d="M4 20V11" /><path d="M10 20V4" /><path d="M16 20v-6" /><path d="M22 20H2" /></>),
  Image: mk(<><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>),
};
