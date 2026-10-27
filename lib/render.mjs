// Pure renderer shared by the server (SSR for the public page) and the admin
// live preview. Keep it free of Node-only imports so it can be served to the
// browser as a plain ES module.

export const FONTS = {
  'noto-sans-thai': { label: 'Noto Sans Thai', stack: "'Noto Sans Thai', sans-serif", google: 'Noto+Sans+Thai:wght@400;500;600;700;800' },
  prompt: { label: 'Prompt', stack: "'Prompt', sans-serif", google: 'Prompt:wght@300;400;500;600;700' },
  kanit: { label: 'Kanit', stack: "'Kanit', sans-serif", google: 'Kanit:wght@300;400;500;600;700' },
  sarabun: { label: 'Sarabun', stack: "'Sarabun', sans-serif", google: 'Sarabun:wght@400;500;600;700;800' },
  mitr: { label: 'Mitr', stack: "'Mitr', sans-serif", google: 'Mitr:wght@300;400;500;600' },
  'ibm-plex-thai': { label: 'IBM Plex Sans Thai', stack: "'IBM Plex Sans Thai', sans-serif", google: 'IBM+Plex+Sans+Thai:wght@400;500;600;700' },
  'bai-jamjuree': { label: 'Bai Jamjuree', stack: "'Bai Jamjuree', sans-serif", google: 'Bai+Jamjuree:wght@400;500;600;700' },
  anuphan: { label: 'Anuphan', stack: "'Anuphan', sans-serif", google: 'Anuphan:wght@400;500;600;700' },
  system: { label: 'System (ไม่โหลดฟอนต์)', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif", google: '' },
};

// Simple, recognisable glyphs. 24x24 viewBox, currentColor.
export const ICONS = {
  link: '<path d="M10.6 13.4a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3"/>',
  email: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3.5 7 7.4 5.3a2 2 0 0 0 2.2 0L20.5 7"/>',
  youtube: '<path d="M22 12s0-3.4-.4-5a2.6 2.6 0 0 0-1.8-1.8C18.1 4.8 12 4.8 12 4.8s-6.1 0-7.8.4A2.6 2.6 0 0 0 2.4 7C2 8.6 2 12 2 12s0 3.4.4 5a2.6 2.6 0 0 0 1.8 1.8c1.7.4 7.8.4 7.8.4s6.1 0 7.8-.4A2.6 2.6 0 0 0 21.6 17c.4-1.6.4-5 .4-5Z"/><path d="m10 15 5-3-5-3Z" fill="currentColor"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/>',
  tiktok: '<path d="M14 3v11.2a3.6 3.6 0 1 1-3.1-3.6"/><path d="M14 3c.4 2.5 2 4.2 4.6 4.5"/>',
  facebook: '<path d="M14.5 21v-8h2.7l.5-3.2h-3.2V7.8c0-.9.3-1.6 1.7-1.6h1.6V3.3c-.8-.1-1.7-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.2H8v3.2h2.8V21Z"/>',
  line: '<path d="M21 10.4c0-4-4-7.3-9-7.3s-9 3.3-9 7.3c0 3.6 3.2 6.6 7.5 7.2.3.1.7.2.8.5.1.3.1.6 0 .9l-.1.8c0 .2-.2 1 .8.5s5.4-3.2 7.3-5.4c1.2-1.4 1.7-2.8 1.7-4.5Z"/>',
  x: '<path d="m4 4 7 9.3M20 20l-7-9.3M4 4h3.2L20 20h-3.2M4 20l6.2-7M20 4l-6.2 7"/>',
  threads: '<path d="M16.5 12.2c-.3-3-2-4.4-4.4-4.4-1.6 0-2.8.6-3.5 1.7"/><path d="M12.2 21c-5 0-8.2-3.1-8.2-9S7.2 3 12.2 3c3.8 0 6.4 1.7 7.5 4.6"/><path d="M15 15.6c-.6.9-1.7 1.5-3 1.5-1.6 0-2.7-.8-2.7-2 0-1.3 1.2-2 3-2 2.6 0 4.2 1 4.2 3.2 0 2-1.5 3.7-4.3 3.7"/>',
  spotify: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5c3-.8 6-.6 8.6.8M8.3 13c2.4-.6 4.7-.4 6.8.7M9 16.2c1.8-.4 3.5-.3 5 .5"/>',
  shopee: '<path d="M4.5 8h15l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H7a1.5 1.5 0 0 1-1.5-1.4Z"/><path d="M8.5 8V6.6a3.5 3.5 0 0 1 7 0V8"/><path d="M13.8 12.2c-.4-.5-1-.8-1.8-.8-1.1 0-1.9.5-1.9 1.4 0 2 3.9 1.2 3.9 3.3 0 1-.9 1.6-2.1 1.6-.9 0-1.6-.3-2.1-.9"/>',
  lazada: '<path d="M12 3 4 7.6v7.2L12 21l8-6.2V7.6Z"/><path d="M12 10.5 8 8.2M12 10.5l4-2.3M12 10.5V21"/>',
  lemon8: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M9 9.8c2-1.4 4-1.4 6 0M9 14.2c2 1.4 4 1.4 6 0"/>',
  discord: '<path d="M8.5 6.5A14 14 0 0 1 12 6c1.2 0 2.4.2 3.5.5L17 5c2.5 1 4 3 4.5 5.5.6 3-.2 5.8-1.8 7.4-1.2.8-2.4 1.3-3.7 1.6l-1-1.8"/><path d="M8.5 6.5 7 5C4.5 6 3 8 2.5 10.5c-.6 3 .2 5.8 1.8 7.4 1.2.8 2.4 1.3 3.7 1.6l1-1.8"/><circle cx="9.3" cy="13" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.3" fill="currentColor" stroke="none"/>',
  github: '<path d="M9 19c-4 1.3-4-2.2-5.7-2.7M15 21v-3.4c0-.9-.1-1.3-.6-1.8 2.5-.3 5-1.3 5-5.6a4.3 4.3 0 0 0-1.2-3 4 4 0 0 0-.1-3s-1-.3-3.2 1.2a11 11 0 0 0-5.8 0C5.9 3.9 4.9 4.2 4.9 4.2a4 4 0 0 0-.1 3 4.3 4.3 0 0 0-1.2 3c0 4.3 2.5 5.3 5 5.6-.4.4-.6.9-.6 1.8V21"/>',
  phone: '<path d="M7 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 5.5 5.7 2 2 0 0 1 7 3.5Z"/>',
  whatsapp: '<path d="M3.5 20.5 5 16.6A8.2 8.2 0 1 1 8.2 19.7Z"/><path d="M9 9.2c.3 1.9 2.4 4.3 4.5 4.8l1-1.4 2 .9v1.3c-.1.5-.6.9-1.2.9-2.9-.2-6.4-3.6-6.8-6.6 0-.6.3-1.1.9-1.2h1.2Z"/>',
  telegram: '<path d="m21 4.5-3 15-5.2-3.8-2.6 2.5-.5-4L19 7 8.3 13.3 3 11.6Z"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
  cart: '<path d="M3 4h2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.2L21 8H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8Z"/>',
  fire: '<path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-1.4.6-2.7 1.4-3.8.3 1.2 1 2 2 2.3C10 7.5 11 5 12 3Z"/><path d="M12 21a5 5 0 0 0 5-5"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5Z" fill="currentColor"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.1A8 8 0 1 1 21 12Z"/>',
  heart: '<path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-2.8c0 .4 0 .4 0 .6 0 4.9-7 9.2-7 9.2Z"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z"/><circle cx="12" cy="13.5" r="3.5"/>',
};

export const SOCIAL_PLATFORMS = [
  ['email', 'อีเมล'], ['line', 'LINE'], ['youtube', 'YouTube'], ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'], ['facebook', 'Facebook'], ['x', 'X / Twitter'], ['threads', 'Threads'],
  ['lemon8', 'Lemon8'], ['shopee', 'Shopee'], ['lazada', 'Lazada'], ['spotify', 'Spotify'],
  ['discord', 'Discord'], ['telegram', 'Telegram'], ['whatsapp', 'WhatsApp'], ['phone', 'โทรศัพท์'],
  ['github', 'GitHub'], ['website', 'เว็บไซต์'],
];

export const SECTION_TYPES = {
  links: 'ปุ่มลิงก์',
  cards: 'การ์ดสินค้า / ป้ายยา',
  gallery: 'แกลเลอรีรูป',
  video: 'วิดีโอ YouTube',
  text: 'ข้อความ / หัวข้อ',
  socials: 'แถวไอคอนโซเชียล',
  embed: 'ฝังเนื้อหา (iframe)',
  spacer: 'เว้นระยะ / เส้นคั่น',
};

/* ---------------------------------------------------------------- helpers */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function safeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(raw)) return raw;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(raw)) return `mailto:${raw}`;
  if (/^[a-z][\w+.-]*:/i.test(raw)) return ''; // block javascript:, data:, etc.
  return `https://${raw}`;
}

function nl2br(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}

function icon(name, cls = 'ic') {
  const path = ICONS[name] || ICONS.link;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function youtubeId(url) {
  const m = String(url ?? '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{6,})/i
  );
  return m ? m[1] : /^[\w-]{6,}$/.test(String(url ?? '').trim()) ? String(url).trim() : '';
}

function media(src, alt = '', cls = '', loading = 'lazy') {
  const url = safeUrl(src);
  if (!url) return '';
  return `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="${loading}" decoding="async">`;
}

function trackAttrs(id, preview) {
  return preview ? '' : ` data-track="${esc(id)}"`;
}

/* -------------------------------------------------------------- the theme */

function themeCss(theme = {}, header = {}) {
  const t = {
    bg: '#000000', text: '#ffffff', muted: '#9ca3af', card: '#161616',
    cardBorder: '#2a2a2a', accent: '#ffffff', accentText: '#000000',
    radius: 18, maxWidth: 580, font: 'noto-sans-thai', bgType: 'solid',
    bgGradientFrom: '#1f1f23', bgGradientTo: '#000000', bgImage: '',
    cardShadow: true, buttonStyle: 'soft', ...theme,
  };
  const font = FONTS[t.font] || FONTS['noto-sans-thai'];
  let background = t.bg;
  if (t.bgType === 'gradient') background = `linear-gradient(170deg, ${t.bgGradientFrom}, ${t.bgGradientTo})`;
  const btn = {
    solid: { bg: 'var(--accent)', border: 'transparent', text: 'var(--accent-text)' },
    outline: { bg: 'transparent', border: 'var(--accent)', text: 'var(--text)' },
    soft: { bg: 'var(--card)', border: 'var(--card-border)', text: 'var(--text)' },
  }[t.buttonStyle] || { bg: 'var(--card)', border: 'var(--card-border)', text: 'var(--text)' };

  const bgImage = t.bgType === 'image' && safeUrl(t.bgImage)
    ? `body::before{content:"";position:fixed;inset:0;z-index:-1;background:url("${esc(safeUrl(t.bgImage))}") center/cover no-repeat;}
       body::after{content:"";position:fixed;inset:0;z-index:-1;background:${esc(t.bg)};opacity:${Number(t.bgImageDim ?? 0.55)};}`
    : '';

  return `:root{
  --bg:${t.bg};
  --bg-paint:${background};
  --text:${t.text};
  --muted:${t.muted};
  --card:${t.card};
  --card-border:${t.cardBorder};
  --accent:${t.accent};
  --accent-text:${t.accentText};
  --radius:${Number(t.radius) || 0}px;
  --maxw:${Number(t.maxWidth) || 580}px;
  --font:${font.stack};
  --shadow:${t.cardShadow ? '0 10px 30px rgba(0,0,0,.28)' : 'none'};
  --btn-bg:${btn.bg};
  --btn-border:${btn.border};
  --btn-text:${btn.text};
  --cover-h:${Number(header.coverHeight) || 420}px;
  --overlay:${Number(header.overlay ?? 0.45)};
}
${bgImage}`;
}

/* ------------------------------------------------------------- the header */

function renderHeader(header = {}, preview) {
  const h = { layout: 'cover', align: 'center', showSocials: true, ...header };
  const socials = h.showSocials ? renderSocialRow(h.socials, preview, 'head-socials') : '';
  const text = `
    ${h.title ? `<h1 class="head-title"${h.titleSize ? ` style="font-size:${Number(h.titleSize)}px"` : ''}>${esc(h.title)}</h1>` : ''}
    ${h.subtitle ? `<p class="head-sub">${nl2br(h.subtitle)}</p>` : ''}`;
  const bio = h.bio ? `<p class="head-bio">${nl2br(h.bio)}</p>` : '';

  if (h.layout === 'cover') {
    return `<header class="head head-cover" data-align="${esc(h.align)}">
      <div class="cover">
        ${media(h.coverImage, h.title, 'cover-img', 'eager')}
        <div class="cover-fade"></div>
        <div class="cover-inner">${text}${socials}</div>
      </div>
      ${bio ? `<div class="head-below">${bio}</div>` : ''}
    </header>`;
  }
  if (h.layout === 'banner') {
    return `<header class="head head-banner" data-align="${esc(h.align)}">
      <div class="banner">${media(h.coverImage, h.title, 'banner-img', 'eager')}</div>
      ${h.avatar ? `<div class="avatar avatar-lift">${media(h.avatar, h.title, '', 'eager')}</div>` : ''}
      <div class="head-below">${text}${bio}${socials}</div>
    </header>`;
  }
  if (h.layout === 'avatar') {
    return `<header class="head head-avatar" data-align="${esc(h.align)}">
      ${h.avatar ? `<div class="avatar">${media(h.avatar, h.title, '', 'eager')}</div>` : ''}
      <div class="head-below">${text}${bio}${socials}</div>
    </header>`;
  }
  return `<header class="head head-minimal" data-align="${esc(h.align)}">
    <div class="head-below">${text}${bio}${socials}</div>
  </header>`;
}

function renderSocialRow(items, preview, cls = 'socials') {
  const list = (items || []).filter((s) => s && s.visible !== false && safeUrl(s.url));
  if (!list.length) return '';
  return `<div class="${cls}">${list.map((s) => {
    const url = s.platform === 'email' && !/^mailto:/i.test(s.url) && /@/.test(s.url)
      ? `mailto:${s.url}` : safeUrl(s.url);
    return `<a class="social" href="${esc(url)}" target="_blank" rel="noopener noreferrer"
      aria-label="${esc(s.label || s.platform)}" title="${esc(s.label || s.platform)}"${trackAttrs(s.id, preview)}>${icon(s.platform)}</a>`;
  }).join('')}</div>`;
}

/* ----------------------------------------------------------- the sections */

function sectionHead(s) {
  if (!s.title && !s.subtitle) return '';
  return `<div class="sec-head">
    ${s.title ? `<h2 class="sec-title">${esc(s.title)}</h2>` : ''}
    ${s.subtitle ? `<p class="sec-sub">${nl2br(s.subtitle)}</p>` : ''}
  </div>`;
}

function renderLinks(s, preview) {
  const items = (s.items || []).filter((i) => i && i.visible !== false);
  if (!items.length) return '';
  return `<div class="links" data-style="${esc(s.style || 'list')}">${items.map((i) => {
    const thumb = i.iconType === 'image' && i.image
      ? `<span class="link-ic img">${media(i.image, i.title, '')}</span>`
      : i.iconType === 'emoji' && i.emoji
        ? `<span class="link-ic emoji">${esc(i.emoji)}</span>`
        : i.iconType === 'none' ? ''
          : `<span class="link-ic">${icon(i.icon || 'link')}</span>`;
    return `<a class="link-btn${i.highlight ? ' is-hot' : ''}" href="${esc(safeUrl(i.url))}"
      target="_blank" rel="noopener noreferrer"${trackAttrs(i.id, preview)}>
      ${thumb}
      <span class="link-tx">
        <span class="link-t">${esc(i.title || '')}</span>
        ${i.subtitle ? `<span class="link-s">${nl2br(i.subtitle)}</span>` : ''}
      </span>
      ${i.badge ? `<span class="link-badge">${esc(i.badge)}</span>` : ''}
      <span class="link-ar" aria-hidden="true">›</span>
    </a>`;
  }).join('')}</div>`;
}

function renderCards(s, preview) {
  const items = (s.items || []).filter((i) => i && i.visible !== false);
  if (!items.length) return '';
  const layout = s.layout || 'alternate';
  return `<div class="cards" data-layout="${esc(layout)}" data-cols="${esc(s.columns || 1)}">${items.map((i, idx) => {
    const side = layout === 'alternate' ? (idx % 2 === 0 ? 'left' : 'right')
      : layout === 'image-right' ? 'right' : 'left';
    const url = safeUrl(i.url);
    const tag = url ? 'a' : 'div';
    return `<${tag} class="card" data-side="${side}"${url ? ` href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : ''}${trackAttrs(i.id, preview)}>
      ${i.image ? `<div class="card-media">${media(i.image, i.title)}</div>` : ''}
      <div class="card-body">
        ${i.badge ? `<span class="card-badge">${esc(i.badge)}</span>` : ''}
        ${i.title ? `<h3 class="card-title">${nl2br(i.title)}</h3>` : ''}
        ${i.subtitle ? `<p class="card-sub">${nl2br(i.subtitle)}</p>` : ''}
        ${i.price ? `<p class="card-price">${esc(i.price)}</p>` : ''}
        ${url && i.cta ? `<span class="card-cta">${esc(i.cta)}</span>` : ''}
      </div>
    </${tag}>`;
  }).join('')}</div>`;
}

function renderGallery(s, preview) {
  const items = (s.items || []).filter((i) => i && i.visible !== false && i.image);
  if (!items.length) return '';
  return `<div class="gallery" data-cols="${esc(s.columns || 2)}" data-ratio="${esc(s.ratio || 'square')}">${items.map((i) => {
    const url = safeUrl(i.url);
    const tag = url ? 'a' : 'div';
    return `<${tag} class="gal"${url ? ` href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : ''}${trackAttrs(i.id, preview)}>
      ${media(i.image, i.caption)}
      ${i.caption ? `<span class="gal-cap">${esc(i.caption)}</span>` : ''}
    </${tag}>`;
  }).join('')}</div>`;
}

function renderVideo(s) {
  const items = (s.items || []).filter((i) => i && i.visible !== false && youtubeId(i.url));
  if (!items.length) return '';
  return `<div class="videos">${items.map((i) => `
    <figure class="video">
      <iframe src="https://www.youtube-nocookie.com/embed/${esc(youtubeId(i.url))}" title="${esc(i.title || 'video')}"
        loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      ${i.title ? `<figcaption>${esc(i.title)}</figcaption>` : ''}
    </figure>`).join('')}</div>`;
}

function renderText(s) {
  return `<div class="text-block" data-align="${esc(s.align || 'left')}">
    ${s.heading ? `<h3 class="text-h">${esc(s.heading)}</h3>` : ''}
    ${s.body ? `<p class="text-b">${nl2br(s.body)}</p>` : ''}
  </div>`;
}

function renderEmbed(s) {
  const url = safeUrl(s.url);
  if (!url || !/^https:/i.test(url)) return '';
  return `<div class="embed" style="height:${Number(s.height) || 400}px">
    <iframe src="${esc(url)}" title="${esc(s.title || 'embed')}" loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>`;
}

function renderSpacer(s) {
  return `<div class="spacer" style="height:${Number(s.height ?? 24)}px">${s.divider ? '<hr>' : ''}</div>`;
}

function renderSection(s, preview) {
  let body = '';
  switch (s.type) {
    case 'links': body = renderLinks(s, preview); break;
    case 'cards': body = renderCards(s, preview); break;
    case 'gallery': body = renderGallery(s, preview); break;
    case 'video': body = renderVideo(s); break;
    case 'text': body = renderText(s); break;
    case 'socials': body = renderSocialRow(s.items, preview); break;
    case 'embed': body = renderEmbed(s); break;
    case 'spacer': body = renderSpacer(s); break;
    default: body = '';
  }
  if (s.type === 'spacer') return body;
  const head = sectionHead(s);
  if (!head && !body) return '';
  return `<section class="sec sec-${esc(s.type)}" id="sec-${esc(s.id)}">${head}${body}</section>`;
}

/* ------------------------------------------------------------ the whole page */

export function renderBody(data, { preview = false } = {}) {
  const sections = (data.sections || []).filter((s) => s && s.visible !== false);
  return `<main class="page">
    ${renderHeader(data.header, preview)}
    <div class="stack">${sections.map((s) => renderSection(s, preview)).join('\n')}</div>
    ${data.site?.footerText || data.site?.showCredit !== false ? `<footer class="foot">
      ${data.site?.footerText ? `<p>${nl2br(data.site.footerText)}</p>` : ''}
      ${data.site?.showCredit !== false ? `<p class="credit">สร้างด้วย <span>LinkHub</span></p>` : ''}
    </footer>` : ''}
  </main>`;
}

export function renderPage(data, { preview = false, cssHref = '/site.css', jsHref = '/site.js', baseHref = '/' } = {}) {
  const site = data.site || {};
  const theme = data.theme || {};
  const header = data.header || {};
  const font = FONTS[theme.font] || FONTS['noto-sans-thai'];
  const title = site.metaTitle || header.title || 'LinkHub';
  const desc = site.metaDescription || header.subtitle || '';
  const ogImage = safeUrl(site.ogImage || header.coverImage || header.avatar || '');
  const favicon = safeUrl(site.favicon || header.avatar || '');

  const fontLink = font.google
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
       <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
       <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font.google}&display=swap">`
    : '';

  const pixels = preview ? '' : renderPixels(site);

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<base href="${esc(baseHref)}">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
${desc ? `<meta property="og:description" content="${esc(desc)}">` : ''}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
${favicon ? `<link rel="icon" href="${esc(favicon)}">` : ''}
<meta name="theme-color" content="${esc(theme.bg || '#000000')}">
${fontLink}
<link rel="stylesheet" href="${esc(cssHref)}">
<style>${themeCss(theme, header)}</style>
${site.customCss ? `<style>${String(site.customCss).replace(/<\/style/gi, '<\\/style')}</style>` : ''}
${pixels}
</head>
<body${preview ? ' data-preview="1"' : ''}>
${renderBody(data, { preview })}
${preview ? '' : `<script src="${esc(jsHref)}" defer></script>`}
</body>
</html>`;
}

function renderPixels(site) {
  let out = '';
  if (site.gaId && /^[\w-]+$/.test(site.gaId)) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.gaId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(site.gaId)}');</script>`;
  }
  if (site.metaPixelId && /^\d+$/.test(site.metaPixelId)) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(site.metaPixelId)}');fbq('track','PageView');</script>`;
  }
  if (site.tiktokPixelId && /^[\w]+$/.test(site.tiktokPixelId)) {
    out += `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=n;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]={};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${esc(site.tiktokPixelId)}');ttq.page()}(window,document,'ttq');</script>`;
  }
  return out;
}
