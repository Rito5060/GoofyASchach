// Eigene flache SVG-Icons für Fähigkeiten und Events (24×24, currentColor)
(function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor"';
  const P = {
    skip: `<path ${F} d="M3 5.5v13l8-6.5z"/><path ${F} d="M11 5.5v13l8-6.5z"/><rect ${F} x="19.5" y="5" width="2.5" height="14" rx="1"/>`,
    blitz: `<path ${F} d="M13.5 2 4 13.5h6.5L9 22l10-12.5h-6.5z"/>`,
    bomb: `<circle ${F} cx="10" cy="14" r="7"/><path ${S} d="M14.5 9.5 17 7"/><path ${S} d="M19 2.5v2M21.5 5h-2M20.8 3.2l-1.3 1.3"/><circle fill="#fff" opacity=".45" cx="7.5" cy="11.5" r="1.8"/>`,
    kamikaze: `<rect ${F} x="2.5" y="10" width="14" height="10" rx="2"/><path stroke="#000" stroke-opacity=".25" stroke-width="1.6" d="M7.2 10v10M11.8 10v10"/><path ${S} d="M16.5 12c3 0 4-2 4-5"/><circle ${F} cx="20.5" cy="4.5" r="2"/>`,
    teleport: `<path ${S} d="M12 12a2 2 0 1 1 2 2 4 4 0 1 1-4-4 6 6 0 1 1 6 6 8 8 0 0 1-8-8"/>`,
    shield: `<path ${F} d="M12 2 20 5v6.5c0 5-3.4 9-8 10.5-4.6-1.5-8-5.5-8-10.5V5z"/><path stroke="#fff" stroke-opacity=".5" stroke-width="2.2" fill="none" stroke-linecap="round" d="M8.5 11.5l2.5 2.5 4.5-5"/>`,
    freeze: `<path ${S} d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.5 10.5 6 9.5l-.8-3M20.5 13.5 18 14.5l.8 3M3.5 13.5l2.5 1-.8 3M20.5 10.5 18 9.5l.8-3"/>`,
    clone: `<rect ${S} x="3" y="3" width="12" height="12" rx="2.5"/><rect ${F} x="9" y="9" width="12" height="12" rx="2.5"/>`,
    mutate: `<path ${S} d="M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10M8.5 6h7M8.5 18h7M10 12h4"/>`,
    steal: `<path ${F} d="M9 2.5h6l-1.8 4h-2.4z"/><path ${F} d="M10 8h4c4 2.5 6 6 6 9 0 3-2.5 4.5-8 4.5S4 20 4 17c0-3 2-6.5 6-9z"/><path stroke="#000" stroke-opacity=".3" stroke-width="1.8" fill="none" stroke-linecap="round" d="M12 11v8M14.2 12.5c-.5-.6-1.3-.9-2.2-.9-1.2 0-2 .6-2 1.5 0 2 4.4 1 4.4 3 0 .9-1 1.5-2.2 1.5-1 0-1.9-.4-2.4-1"/>`,
    quake: `<path ${S} d="M2 20h20"/><path ${S} d="M12.5 3 9.5 9l4 2-3.5 9"/><path ${S} d="M4 8c1.5-1 2.5 1 4 0M16 6c1.5-1 2.5 1 4 0"/>`,
    tornado: `<path ${S} d="M3 4h18M5 8h15M7.5 12h11M10 16h7M12 20h3"/>`,
    army: `<circle ${F} cx="9" cy="6.5" r="3.2"/><path ${F} d="M5.2 19c0-4 1.4-6.5 3.8-8.3 2.4 1.8 3.8 4.3 3.8 8.3z"/><rect ${F} x="3.5" y="18.5" width="11" height="3" rx="1"/><path ${S} d="M19 4v6M16 7h6"/>`,
    sniper: `<circle ${S} cx="12" cy="12" r="7"/><path ${S} d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle ${F} cx="12" cy="12" r="1.8"/>`,
    chain: `<path ${F} d="M9 1.5 3 9.5h4l-1 6 6.5-8.5h-4z"/><path ${F} d="M17.5 7.5l-6 8h4l-1 7 6.5-9h-4z"/>`,
    poison: `<path ${S} d="M9 2.5h6M10 2.5v6L4.8 18.3A2 2 0 0 0 6.6 21.5h10.8a2 2 0 0 0 1.8-3.2L14 8.5v-6"/><path ${F} d="M7.3 14h9.4l2.5 4.6a1.4 1.4 0 0 1-1.2 2.1H6a1.4 1.4 0 0 1-1.2-2.1z"/>`,
    promote: `<path ${F} d="M3 17.5 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 10.5z"/><rect ${F} x="3" y="19" width="18" height="2.8" rx="1"/>`,
    revive: `<path ${F} d="M12 21s-8.5-5-8.5-11.2A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.6C20.5 16 12 21 12 21z"/><path stroke="#fff" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round" d="M12 10.5v6M9 13.5h6"/>`,
    swap: `<path ${S} d="M4 8h15l-4-4M20 16H5l4 4"/>`,
    pass: `<path ${F} d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>`,
    // Events
    meteor: `<circle ${F} cx="15" cy="9" r="5.5"/><path ${S} d="M3 21l7-7M2.5 14.5l4.5-3M9.5 21.5l3-4.5"/>`,
    lava: `<path ${F} d="M12 2c1.2 4.2 6.5 6.3 6.5 12.2a6.5 6.5 0 0 1-13 0c0-3.2 2-5.2 3.2-6.4 0 2.2 1 3.4 2.3 3.4C10 8 10.8 4.8 12 2z"/>`,
    ice: `<path ${F} d="M12 2 21 7v10l-9 5-9-5V7z"/><path stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none" d="M12 12v10M12 12l9-5M12 12 3 7"/>`,
    rotate: `<path ${S} d="M20 12a8 8 0 1 1-2.4-5.7"/><path ${S} d="M20.5 3.5v5h-5"/>`,
    double: `<text x="12" y="17.5" text-anchor="middle" font-size="14" font-weight="900" font-family="Rubik, sans-serif" fill="currentColor">×2</text>`,
    pawns: `<circle ${F} cx="12" cy="9" r="3.2"/><path ${F} d="M8.2 21c0-4 1.4-6.5 3.8-8.3 2.4 1.8 3.8 4.3 3.8 8.3z"/><path ${S} d="M12 1.5v2.5M9.5 3.5 12 1.5l2.5 2"/>`,
    gift: `<rect ${F} x="3.5" y="10" width="17" height="11" rx="1.5"/><rect ${F} x="2" y="6.5" width="20" height="4.5" rx="1.2"/><path stroke="#000" stroke-opacity=".25" stroke-width="2.4" d="M12 6.5V21"/><path ${S} d="M12 6.5C10 2.5 6.5 3 7.5 5.5 8 6.5 12 6.5 12 6.5zM12 6.5c2-4 5.5-3.5 4.5-1-.5 1-4.5 1-4.5 1z"/>`,
    frost: `<path ${S} d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><circle ${F} cx="12" cy="12" r="3"/>`,
    crown: `<path ${F} d="M3 17.5 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 10.5z"/>`,
    skull: `<path ${F} d="M12 2.5c-5 0-8.5 3.4-8.5 8 0 2.7 1.3 4.6 3.5 5.7V20a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20v-3.8c2.2-1.1 3.5-3 3.5-5.7 0-4.6-3.5-8-8.5-8z"/><circle fill="#000" opacity=".55" cx="8.7" cy="11.3" r="2.1"/><circle fill="#000" opacity=".55" cx="15.3" cy="11.3" r="2.1"/>`,
    flag: `<path ${S} d="M5 22V3"/><path ${F} d="M5 3h13l-3 4.5 3 4.5H5z"/>`,
    plug: `<path ${S} d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>`,
    fire: `<path ${F} d="M12 2c1.2 4.2 6.5 6.3 6.5 12.2a6.5 6.5 0 0 1-13 0c0-3.2 2-5.2 3.2-6.4 0 2.2 1 3.4 2.3 3.4C10 8 10.8 4.8 12 2z"/>`,
    knight: `<text x="12" y="19.5" text-anchor="middle" font-size="20" fill="currentColor">&#9822;&#xFE0E;</text>`,
    rematch: `<path ${S} d="M20 12a8 8 0 1 1-2.4-5.7"/><path ${S} d="M20.5 3.5v5h-5"/>`,
  };
  P['rule-backpawns'] = `<circle ${F} cx="12" cy="6.5" r="3.2"/><path ${F} d="M8.2 18.5c0-4 1.4-6.5 3.8-8.3 2.4 1.8 3.8 4.3 3.8 8.3z"/><path ${S} d="M12 19.5v3M9.5 20.5 12 22.5l2.5-2"/>`;
  P['rule-knights'] = `<text x="12" y="19.5" text-anchor="middle" font-size="20" fill="currentColor">&#9822;&#xFE0E;</text><path ${S} d="M19 3v5M16.5 5.5h5"/>`;
  P['rule-ghost'] = `<path ${F} d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5v11.5l2.5-2 2.5 2 2.5-2 2.5 2 2.5-2 2.5 2V10A7.5 7.5 0 0 0 12 2.5z"/><circle fill="#000" opacity=".5" cx="9" cy="10" r="1.7"/><circle fill="#000" opacity=".5" cx="15" cy="10" r="1.7"/>`;
  P['rule-peace'] = `<circle ${S} cx="12" cy="12" r="9.5"/><path ${S} d="M12 2.5v19M12 12l-6.7 6.7M12 12l6.7 6.7"/>`;
  P['rule-sprint'] = `<path ${F} d="M7 18.5 6 9l4 3.5L13 6l3 6.5 4-3.5-1 9.5z"/><path ${S} d="M2 8h2.5M1.5 12h3M2 16h2.5"/>`;
  P['rule-sale'] = `<path ${F} d="M3 3h8.5l9.5 9.5-8.5 8.5L3 11.5z"/><circle fill="#000" opacity=".4" cx="7.5" cy="7.5" r="1.8"/><path stroke="#000" stroke-opacity=".4" stroke-width="2" stroke-linecap="round" d="M10 15l5-5"/>`;
  for (const k of ['backpawns', 'knights', 'ghost', 'peace', 'sprint', 'sale']) P[k] = P['rule-' + k];
  P.mutation = P.mutate;
  P.quakeEv = P.quake;

  window.Icons = {
    svg(name, cls) {
      const body = P[name] || P.knight;
      return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
    },
    has: (name) => !!P[name],
  };
})();
