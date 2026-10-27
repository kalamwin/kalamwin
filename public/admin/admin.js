import { renderPage, FONTS, ICONS, SOCIAL_PLATFORMS, SHOP_PLATFORMS, SECTION_TYPES } from '/shared/render.mjs';

/* ----------------------------------------------------------- utilities */

const $ = (sel, root = document) => root.querySelector(sel);

function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** append(), but conditional `null` children are dropped instead of stringified. */
function fill(node, ...kids) {
  node.append(...kids.flat().filter(Boolean));
  return node;
}

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function api(path, { method = 'GET', body, raw, headers } = {}) {
  const res = await fetch(path, {
    method,
    headers: raw ? headers : { 'Content-Type': 'application/json', ...headers },
    body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/api/login') { showLogin(); throw new Error('unauthorized'); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

let toastTimer;
function toast(message, kind = '') {
  const el = $('#toast');
  el.textContent = message;
  el.style.background = kind === 'err' ? '#b91c1c' : kind === 'ok' ? '#15803d' : '#0f1115';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/** Secondary fields live behind a toggle so the common case stays short. */
function advanced(label, ...fields) {
  const kids = fields.flat().filter(Boolean);
  if (!kids.length) return null;
  const box = h('details', { class: 'adv' }, h('summary', { text: label || 'ตัวเลือกเพิ่มเติม' }));
  return fill(box, ...kids);
}

/** A row of mutually exclusive choices — lighter than a <select> for 2-4 options. */
function segField(obj, key, label, options, opts = {}) {
  const row = h('div', { class: 'seg' });
  for (const [value, text] of options) {
    const btn = h('button', {
      class: `seg-b${String(obj[key] ?? options[0][0]) === String(value) ? ' active' : ''}`, type: 'button',
      onclick: () => {
        obj[key] = value;
        row.querySelectorAll('.seg-b').forEach((n) => n.classList.remove('active'));
        btn.classList.add('active');
        touch();
        opts.onChange?.(value);
      },
    }, text);
    row.append(btn);
  }
  return wrapField(label, row, opts.sub);
}

function modal(title, body) {
  const close = () => overlay.remove();
  const overlay = h('div', {
    class: 'overlay',
    onclick: (e) => { if (e.target === overlay) close(); },
  }, h('div', { class: 'sheet' },
    h('div', { class: 'sheet-head' },
      h('h3', { text: title }),
      h('button', { class: 'btn btn-ghost btn-icon', type: 'button', onclick: close }, '✕')),
    h('div', { class: 'sheet-body' }, body)));
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  document.body.append(overlay);
  return close;
}

/* --------------------------------------------------------------- state */

let state = null;
let dirty = false;
let activeTab = 'header';
let session = {};
const openSections = new Set();
const openItems = new Set();

function touch() {
  dirty = true;
  updateSaveState();
  schedulePreview();
}

function updateSaveState() {
  const el = $('#save-state');
  el.textContent = dirty ? 'ยังไม่ได้บันทึก' : 'บันทึกแล้ว';
  el.classList.toggle('dirty', dirty);
  $('#btn-save').disabled = !dirty;
}

let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 180);
}

function renderPreview() {
  const frame = $('#preview');
  const scroll = frame.contentWindow?.scrollY || 0;
  frame.srcdoc = renderPage(state, { preview: true, baseHref: `${location.origin}/` });
  frame.addEventListener('load', () => {
    try { frame.contentWindow.scrollTo(0, scroll); } catch { /* cross-doc timing */ }
  }, { once: true });
}

/* -------------------------------------------------------------- fields */

function wrapField(label, control, sub) {
  return h('div', { class: 'field' },
    label ? h('label', { text: label }) : null,
    control,
    sub ? h('div', { class: 'sub', text: sub }) : null);
}

function textField(obj, key, label, opts = {}) {
  const input = h('input', {
    type: opts.type || 'text',
    value: obj[key] ?? '',
    placeholder: opts.placeholder || '',
    oninput: (e) => {
      obj[key] = opts.type === 'number' ? Number(e.target.value) : e.target.value;
      opts.onInput?.(e.target.value);
      touch();
    },
  });
  return wrapField(label, input, opts.sub);
}

function areaField(obj, key, label, opts = {}) {
  const input = h('textarea', {
    placeholder: opts.placeholder || '',
    rows: opts.rows || 3,
    oninput: (e) => { obj[key] = e.target.value; touch(); },
  });
  input.value = obj[key] ?? '';
  return wrapField(label, input, opts.sub);
}

function selectField(obj, key, label, options, opts = {}) {
  const select = h('select', {
    onchange: (e) => { obj[key] = e.target.value; touch(); opts.onChange?.(e.target.value); },
  }, options.map(([value, text]) => h('option', { value, selected: String(obj[key]) === String(value) }, text)));
  return wrapField(label, select, opts.sub);
}

function checkField(obj, key, label, opts = {}) {
  const input = h('input', {
    type: 'checkbox',
    onchange: (e) => { obj[key] = e.target.checked; touch(); opts.onChange?.(e.target.checked); },
  });
  input.checked = !!obj[key];
  return h('label', { class: 'check' }, input, h('span', { text: label }));
}

function colorField(obj, key, label) {
  const hex = h('input', {
    type: 'text', value: obj[key] ?? '#000000',
    oninput: (e) => { obj[key] = e.target.value; picker.value = normaliseHex(e.target.value); touch(); },
  });
  const picker = h('input', {
    type: 'color', value: normaliseHex(obj[key]),
    oninput: (e) => { obj[key] = e.target.value; hex.value = e.target.value; touch(); },
  });
  return wrapField(label, h('div', { class: 'color-row' }, picker, hex));
}

function normaliseHex(value) {
  const v = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v)
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#000000';
}

function rangeField(obj, key, label, { min = 0, max = 100, step = 1, unit = '' } = {}) {
  const out = h('output', { text: `${obj[key] ?? min}${unit}` });
  const input = h('input', {
    type: 'range', min, max, step, value: obj[key] ?? min,
    oninput: (e) => { obj[key] = Number(e.target.value); out.textContent = `${e.target.value}${unit}`; touch(); },
  });
  return wrapField(label, h('div', { class: 'range-row' }, input, out));
}

function imageField(obj, key, label, opts = {}) {
  const preview = h('div', { class: 'img-prev' });
  const url = h('input', {
    type: 'text', value: obj[key] ?? '', placeholder: 'วางลิงก์รูป หรือกดอัปโหลด',
    oninput: (e) => { obj[key] = e.target.value; paint(); touch(); },
  });
  const file = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });

  function paint() {
    preview.innerHTML = '';
    if (obj[key]) preview.append(h('img', { src: obj[key], alt: '' }));
    else preview.textContent = 'ไม่มีรูป';
  }
  paint();

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      toast('กำลังอัปโหลด…');
      const out = await api('/api/upload', { method: 'POST', raw: true, body: f, headers: { 'Content-Type': f.type } });
      obj[key] = out.url;
      url.value = out.url;
      paint();
      touch();
      toast('อัปโหลดเสร็จแล้ว', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      file.value = '';
    }
  });

  return wrapField(label, h('div', { class: 'img-field' },
    preview,
    h('div', { class: 'img-ctrl' },
      url,
      h('div', { class: 'img-btns' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => file.click() }, 'อัปโหลดรูป'),
        obj[key] ? h('button', {
          class: 'btn btn-sm btn-ghost', type: 'button',
          onclick: () => { obj[key] = ''; url.value = ''; paint(); touch(); },
        }, 'ลบรูป') : null,
        file))), opts.sub);
}

function iconField(obj, key, label) {
  const grid = h('div', { class: 'icon-grid' }, Object.keys(ICONS).map((name) => {
    const btn = h('button', {
      class: `icon-pick${obj[key] === name ? ' active' : ''}`, type: 'button', title: name,
      html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`,
      onclick: () => {
        obj[key] = name;
        grid.querySelectorAll('.icon-pick').forEach((n) => n.classList.remove('active'));
        btn.classList.add('active');
        touch();
      },
    });
    return btn;
  }));
  return wrapField(label, grid);
}

/* ------------------------------------------------------- item editors */

/** Nested editor: the shops one catalog product links out to. */
function shopLinksEditor(item) {
  item.links ||= [];
  const wrap = h('div', { class: 'sub-list' });
  const paint = () => {
    wrap.innerHTML = '';
    item.links.forEach((link, i) => {
      wrap.append(h('div', { class: 'sub-row' },
        selectField(link, 'platform', null, SHOP_PLATFORMS, {
          onChange: (v) => {
            const found = SHOP_PLATFORMS.find(([k]) => k === v);
            if (found && !link.label) { link.label = found[1]; paint(); }
          },
        }),
        textField(link, 'label', null, { placeholder: 'ข้อความบนปุ่ม' }),
        textField(link, 'url', null, { placeholder: 'https://…' }),
        h('button', {
          class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ลบ',
          onclick: () => { item.links.splice(i, 1); touch(); paint(); },
        }, '🗑')));
    });
    wrap.append(h('button', {
      class: 'btn btn-sm', type: 'button',
      onclick: () => {
        item.links.push({ id: uid('sl'), platform: 'shopee', label: 'Shopee', url: '', visible: true });
        touch();
        paint();
      },
    }, '+ เพิ่มช่องทางขาย'));
  };
  paint();
  return wrapField('ช่องทางสั่งซื้อ', wrap, 'ใส่ได้หลายร้าน — ถ้าใส่ช่องเดียวจะกลายเป็นปุ่มเต็มกว้าง');
}

const ITEM_FIELDS = {
  links: (item, rerender) => [
    textField(item, 'title', 'ชื่อปุ่ม', { placeholder: 'เช่น ติดต่องาน : ทาง LINE OA' }),
    textField(item, 'url', 'ลิงก์', { placeholder: 'https://…' }),
    segField(item, 'iconType', 'ไอคอน', [
      ['icon', 'ไอคอน'], ['image', 'รูป'], ['emoji', 'อีโมจิ'], ['none', 'ไม่มี'],
    ], { onChange: rerender }),
    item.iconType === 'image' ? imageField(item, 'image', null)
      : item.iconType === 'emoji' ? textField(item, 'emoji', null, { placeholder: '🔥' })
        : item.iconType === 'none' ? null : iconField(item, 'icon', null),
    advanced('ตัวเลือกเพิ่มเติม',
      textField(item, 'subtitle', 'คำอธิบายใต้ชื่อ'),
      textField(item, 'badge', 'ป้ายเล็ก (badge)', { placeholder: 'เช่น ใหม่' }),
      checkField(item, 'highlight', 'เน้นปุ่มนี้ (ตีกรอบสีหลัก)')),
  ],
  catalog: (item) => [
    imageField(item, 'image', 'รูปสินค้า'),
    textField(item, 'title', 'ชื่อสินค้า'),
    h('div', { class: 'grid2' },
      textField(item, 'price', 'ราคา', { placeholder: '199' }),
      textField(item, 'comparePrice', 'ราคาก่อนลด', { placeholder: '299' })),
    shopLinksEditor(item),
    advanced('ตัวเลือกเพิ่มเติม',
      areaField(item, 'description', 'คำอธิบายสั้น', { rows: 2 }),
      textField(item, 'badge', 'ป้ายมุมรูป', { placeholder: 'NEW / SALE' })),
  ],
  cards: (item) => [
    imageField(item, 'image', 'รูปการ์ด'),
    textField(item, 'title', 'หัวข้อ', { placeholder: 'ชื่อสินค้า / ชื่อคลาส' }),
    textField(item, 'url', 'ลิงก์', { placeholder: 'https://…' }),
    advanced('ตัวเลือกเพิ่มเติม',
      areaField(item, 'subtitle', 'คำอธิบาย', { rows: 2 }),
      h('div', { class: 'grid3' },
        textField(item, 'price', 'ราคา', { placeholder: '1,290.-' }),
        textField(item, 'badge', 'ป้ายเล็ก', { placeholder: 'ขายดี' }),
        textField(item, 'cta', 'ข้อความปุ่ม', { placeholder: 'กดสั่งเลย' }))),
  ],
  gallery: (item) => [
    imageField(item, 'image', 'รูป'),
    advanced('ตัวเลือกเพิ่มเติม',
      textField(item, 'caption', 'คำบรรยายบนรูป'),
      textField(item, 'url', 'กดแล้วไปที่ลิงก์')),
  ],
  media: (item) => [
    textField(item, 'url', 'ลิงก์', { placeholder: 'วางลิงก์ที่ก๊อปมาได้เลย' }),
    advanced('ตัวเลือกเพิ่มเติม', textField(item, 'title', 'คำบรรยายใต้คลิป')),
  ],
  list: (item) => [
    h('div', { class: 'grid2' },
      textField(item, 'label', 'หัวข้อ', { placeholder: 'เช่น ที่อยู่ร้าน' }),
      textField(item, 'value', 'ข้อความ', { placeholder: 'เช่น 123 ถ.สุขุมวิท' })),
    iconField(item, 'icon', 'ไอคอน'),
    advanced('ตัวเลือกเพิ่มเติม',
      textField(item, 'url', 'กดแล้วไปที่ลิงก์', { sub: 'เบอร์โทรใช้ tel:0812345678 • แผนที่ใส่ลิงก์ Google Maps' })),
  ],
  socials: (item) => [
    selectField(item, 'platform', 'แพลตฟอร์ม', SOCIAL_PLATFORMS),
    textField(item, 'url', 'ลิงก์ / อีเมล', { placeholder: 'https://… หรือ name@mail.com' }),
    advanced('ตัวเลือกเพิ่มเติม', textField(item, 'label', 'ชื่อเรียก (สำหรับ accessibility)')),
  ],
};

/** Which item editor a section type uses. */
const ITEM_KIND = {
  links: 'links', catalog: 'catalog', cards: 'cards', gallery: 'gallery', list: 'list', socials: 'socials',
  video: 'media', tiktok: 'media', vimeo: 'media', spotify: 'media', soundcloud: 'media', applemusic: 'media',
};

function newItem(kind) {
  const base = { id: uid('it'), visible: true };
  if (kind === 'links') return { ...base, title: 'ปุ่มใหม่', subtitle: '', url: '', iconType: 'icon', icon: 'link' };
  if (kind === 'catalog') {
    return { ...base, title: 'สินค้าใหม่', description: '', price: '', comparePrice: '', image: '', badge: '',
      links: [{ id: uid('sl'), platform: 'shopee', label: 'Shopee', url: '', visible: true }] };
  }
  if (kind === 'cards') return { ...base, title: 'รายการใหม่', subtitle: '', image: '', url: '', cta: 'ดูเลย' };
  if (kind === 'gallery') return { ...base, image: '', caption: '', url: '' };
  if (kind === 'media') return { ...base, title: '', url: '' };
  if (kind === 'list') return { ...base, icon: 'phone', label: '', value: '', url: '' };
  if (kind === 'socials') return { ...base, platform: 'instagram', url: '', label: '' };
  return base;
}

function itemLabel(item, kind) {
  if (kind === 'socials') return item.label || item.platform || 'โซเชียล';
  if (kind === 'gallery') return item.caption || 'รูปภาพ';
  if (kind === 'list') return item.label || item.value || 'รายการ';
  if (kind === 'media') return item.title || item.url || 'ยังไม่ได้ใส่ลิงก์';
  return (item.title || '').replace(/\s+/g, ' ').trim() || 'ยังไม่มีชื่อ';
}

function itemEditor(list, index, type, rerenderList) {
  const item = list[index];
  const node = h('div', {
    class: `item${openItems.has(item.id) ? '' : ' collapsed'}${item.visible === false ? ' hidden-item' : ''}`,
  });
  const titleEl = h('div', { class: 'item-title', text: itemLabel(item, type) });

  const move = (delta) => {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    touch();
    rerenderList();
  };

  node.append(h('div', { class: 'item-bar' },
    h('button', {
      class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ย่อ/ขยาย',
      onclick: () => {
        if (openItems.has(item.id)) openItems.delete(item.id); else openItems.add(item.id);
        node.classList.toggle('collapsed');
      },
    }, openItems.has(item.id) ? '▾' : '▸'),
    titleEl,
    h('button', {
      class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ซ่อน/แสดง',
      onclick: (e) => {
        item.visible = item.visible === false;
        e.currentTarget.textContent = item.visible === false ? '🙈' : '👁';
        node.classList.toggle('hidden-item', item.visible === false);
        touch();
      },
    }, item.visible === false ? '🙈' : '👁'),
    h('button', { class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'เลื่อนขึ้น', onclick: () => move(-1) }, '↑'),
    h('button', { class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'เลื่อนลง', onclick: () => move(1) }, '↓'),
    h('button', {
      class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ทำซ้ำ',
      onclick: () => { list.splice(index + 1, 0, { ...structuredClone(item), id: uid('it') }); touch(); rerenderList(); },
    }, '⧉'),
    h('button', {
      class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ลบ',
      onclick: () => {
        if (!confirm(`ลบ "${itemLabel(item, type)}" ?`)) return;
        list.splice(index, 1); touch(); rerenderList();
      },
    }, '🗑')));

  const body = h('div', { class: 'item-body' });
  const paintBody = () => {
    body.innerHTML = '';
    const fields = (ITEM_FIELDS[type] || (() => []))(item, () => { paintBody(); });
    body.append(...fields.filter(Boolean));
    body.querySelectorAll('input[type="text"], textarea').forEach((input) => {
      input.addEventListener('input', () => { titleEl.textContent = itemLabel(item, type); });
    });
  };
  paintBody();
  node.append(body);
  return node;
}

function itemListEditor(owner, type, { addLabel = 'เพิ่มรายการ' } = {}) {
  owner.items ||= [];
  const wrap = h('div');
  const paint = () => {
    wrap.innerHTML = '';
    if (!owner.items.length) wrap.append(h('div', { class: 'empty', text: 'ยังไม่มีรายการ กดปุ่มด้านล่างเพื่อเพิ่ม' }));
    owner.items.forEach((_, i) => wrap.append(itemEditor(owner.items, i, type, paint)));
    wrap.append(h('div', { class: 'add-row' },
      h('button', {
        class: 'btn btn-sm', type: 'button',
        onclick: () => {
          const item = newItem(type);
          owner.items.push(item);
          openItems.add(item.id);
          touch();
          paint();
        },
      }, `+ ${addLabel}`)));
  };
  paint();
  return wrap;
}

/* ------------------------------------------------------- sections tab */

function newSection(type) {
  const base = { id: uid('sec'), type, visible: true, title: '', subtitle: '' };
  const kind = ITEM_KIND[type];
  switch (type) {
    case 'links': return { ...base, title: 'ลิงก์ของฉัน', style: 'list', items: [newItem(kind)] };
    case 'catalog': return { ...base, title: 'สินค้าของเรา', columns: 2, currency: 'THB', items: [newItem(kind)] };
    case 'cards': return { ...base, title: 'แนะนำ', layout: 'alternate', columns: 1, items: [newItem(kind)] };
    case 'gallery': return { ...base, title: '', display: 'grid', columns: 2, ratio: 'square', size: 'large', items: [newItem(kind)] };
    case 'video': return { ...base, title: 'คลิปล่าสุด', items: [newItem(kind)] };
    case 'tiktok': case 'vimeo': case 'spotify': case 'soundcloud': case 'applemusic':
      return { ...base, items: [newItem(kind)] };
    case 'contact':
      return { ...base, name: '', role: '', org: '', phone: '', email: '', website: '', address: '',
        note: '', avatar: '', vcard: true, saveLabel: 'บันทึกลงรายชื่อติดต่อ' };
    case 'list': return { ...base, title: 'ข้อมูลติดต่อ', items: [newItem(kind)] };
    case 'text': return { ...base, heading: 'หัวข้อ', body: 'ข้อความของคุณ', align: 'center' };
    case 'socials': return { ...base, items: [newItem(kind)] };
    case 'embed': return { ...base, url: '', height: 420 };
    case 'spacer': return { ...base, height: 24, divider: true };
    default: return base;
  }
}

/** The "Add block" gallery — one entry per ready-made block preset. */
const ART = {
  btn1: '<rect x="8" y="7" width="32" height="7" rx="3.5"/><rect x="8" y="18" width="32" height="7" rx="3.5"/><rect x="8" y="29" width="32" height="7" rx="3.5"/>',
  btn2: '<rect x="6" y="9" width="16" height="8" rx="4"/><rect x="26" y="9" width="16" height="8" rx="4"/><rect x="6" y="25" width="16" height="8" rx="4"/><rect x="26" y="25" width="16" height="8" rx="4"/>',
  icons: '<circle cx="12" cy="21" r="6"/><circle cx="24" cy="21" r="6"/><circle cx="36" cy="21" r="6"/>',
  catalog: '<rect x="6" y="6" width="16" height="12" rx="2"/><rect x="26" y="6" width="16" height="12" rx="2"/><rect x="6" y="21" width="11" height="2.5" rx="1.2"/><rect x="26" y="21" width="11" height="2.5" rx="1.2"/><rect x="6" y="27" width="7" height="3" rx="1.5"/><rect x="26" y="27" width="7" height="3" rx="1.5"/><rect x="6" y="34" width="16" height="4" rx="2"/><rect x="26" y="34" width="16" height="4" rx="2"/>',
  cards: '<rect x="5" y="11" width="18" height="20" rx="3"/><rect x="27" y="14" width="16" height="3" rx="1.5"/><rect x="27" y="21" width="12" height="2.5" rx="1.2"/><rect x="27" y="27" width="14" height="4" rx="2"/>',
  grid2: '<rect x="7" y="7" width="14" height="14" rx="2.5"/><rect x="27" y="7" width="14" height="14" rx="2.5"/><rect x="7" y="25" width="14" height="14" rx="2.5"/><rect x="27" y="25" width="14" height="14" rx="2.5"/>',
  grid3: '<rect x="6" y="8" width="9" height="9" rx="2"/><rect x="19" y="8" width="9" height="9" rx="2"/><rect x="32" y="8" width="9" height="9" rx="2"/><rect x="6" y="21" width="9" height="9" rx="2"/><rect x="19" y="21" width="9" height="9" rx="2"/><rect x="32" y="21" width="9" height="9" rx="2"/>',
  sliderL: '<rect x="6" y="8" width="26" height="26" rx="3"/><rect x="36" y="8" width="10" height="26" rx="3"/>',
  sliderS: '<rect x="4" y="13" width="16" height="16" rx="3"/><rect x="24" y="13" width="16" height="16" rx="3"/><rect x="44" y="13" width="6" height="16" rx="3"/>',
  single: '<rect x="12" y="6" width="24" height="30" rx="3"/>',
  list: '<rect x="6" y="11" width="22" height="4" rx="2"/><circle cx="38" cy="13" r="4"/><rect x="6" y="26" width="22" height="4" rx="2"/><circle cx="38" cy="28" r="4"/>',
  text: '<rect x="8" y="9" width="10" height="3" rx="1.5"/><rect x="8" y="17" width="32" height="3" rx="1.5"/><rect x="8" y="24" width="32" height="3" rx="1.5"/><rect x="8" y="31" width="22" height="3" rx="1.5"/>',
  frame: '<rect x="6" y="9" width="36" height="26" rx="3"/><rect x="6" y="9" width="36" height="7" rx="3"/>',
  spacer: '<rect x="6" y="10" width="36" height="3" rx="1.5"/><rect x="6" y="30" width="36" height="3" rx="1.5"/>',
};

const BLOCK_GROUPS = [
  { name: 'ลิงก์', blocks: [
    { label: 'ปุ่มลิงก์', sub: '1 คอลัมน์', art: 'btn1', make: () => ({ ...newSection('links'), style: 'list' }) },
    { label: 'ปุ่มลิงก์', sub: '2 คอลัมน์', art: 'btn2', make: () => ({ ...newSection('links'), style: 'grid' }) },
    { label: 'ไอคอนลิงก์', sub: 'แถวไอคอนกลม', art: 'icons', make: () => newSection('socials') },
  ] },
  { name: 'รูปภาพ / สินค้า', blocks: [
    { label: 'แคตตาล็อกสินค้า', sub: 'ราคา • คำอธิบาย • ลิงก์หลายร้าน', art: 'catalog', badge: 'ใหม่', wide: true, make: () => newSection('catalog') },
    { label: 'การ์ดป้ายยา', sub: 'รูปสลับซ้าย–ขวา', art: 'cards', make: () => newSection('cards') },
    { label: 'ตารางรูป', sub: '2 คอลัมน์', art: 'grid2', make: () => ({ ...newSection('gallery'), display: 'grid', columns: 2 }) },
    { label: 'ตารางรูป', sub: '3 คอลัมน์', art: 'grid3', make: () => ({ ...newSection('gallery'), display: 'grid', columns: 3 }) },
    { label: 'สไลด์รูป', sub: 'รูปใหญ่ เลื่อนข้าง', art: 'sliderL', make: () => ({ ...newSection('gallery'), display: 'slider', size: 'large' }) },
    { label: 'สไลด์รูป', sub: 'จัตุรัส เลื่อนข้าง', art: 'sliderS', make: () => ({ ...newSection('gallery'), display: 'slider', size: 'square' }) },
    { label: 'รูปเดี่ยว', sub: 'ขนาดใหญ่', art: 'single', make: () => ({ ...newSection('gallery'), display: 'grid', columns: 1, ratio: 'auto' }) },
  ] },
  { name: 'ข้อความ', blocks: [
    { label: 'รายการ', sub: 'ที่อยู่ / เบอร์โทร', art: 'list', make: () => newSection('list') },
    { label: 'ข้อความ', sub: 'หัวข้อ + ย่อหน้า', art: 'text', make: () => newSection('text') },
  ] },
  { name: 'อื่น ๆ', blocks: [
    { label: 'YouTube', sub: 'ฝังคลิป', icon: 'youtube', make: () => newSection('video') },
    { label: 'TikTok', sub: 'ฝังคลิป', icon: 'tiktok', make: () => newSection('tiktok') },
    { label: 'Vimeo', sub: 'ฝังคลิป', icon: 'play', make: () => newSection('vimeo') },
    { label: 'นามบัตร', sub: 'บันทึกลงรายชื่อได้', icon: 'camera', make: () => newSection('contact') },
    { label: 'Spotify', sub: 'ฝังเพลง', icon: 'spotify', make: () => newSection('spotify') },
    { label: 'SoundCloud', sub: 'ฝังเสียง', icon: 'chat', make: () => newSection('soundcloud') },
    { label: 'Apple Music', sub: 'ฝังเพลง', icon: 'heart', make: () => newSection('applemusic') },
    { label: 'ฝังเนื้อหา', sub: 'iframe ทั่วไป', art: 'frame', make: () => newSection('embed') },
    { label: 'เว้นระยะ', sub: 'ช่องไฟ / เส้นคั่น', art: 'spacer', make: () => newSection('spacer') },
  ] },
];

function blockArt(block) {
  if (block.art) {
    return `<svg class="block-art" viewBox="0 0 48 44" fill="currentColor" aria-hidden="true">${ART[block.art]}</svg>`;
  }
  return `<svg class="block-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[block.icon] || ICONS.link}</svg>`;
}

function openBlockPicker(onPick) {
  const body = h('div');
  for (const group of BLOCK_GROUPS) {
    body.append(h('h4', { class: 'block-group', text: group.name }));
    const grid = h('div', { class: 'block-grid' });
    for (const block of group.blocks) {
      grid.append(h('button', {
        class: `block-card${block.wide ? ' wide' : ''}`, type: 'button',
        onclick: () => { close(); onPick(block.make()); },
      },
        h('span', { class: 'block-ic', html: blockArt(block) }),
        h('span', { class: 'block-tx' },
          block.badge ? h('span', { class: 'block-badge', text: block.badge }) : null,
          h('b', { text: block.label }),
          h('small', { text: block.sub }))));
    }
    body.append(grid);
  }
  const close = modal('เพิ่มบล็อก', body);
}

function sectionBody(section) {
  const kind = ITEM_KIND[section.type];
  const heading = textField(section, 'title', 'หัวข้อเซคชัน', { placeholder: 'เว้นว่างไว้ก็ได้' });
  const headingAdv = textField(section, 'subtitle', 'คำอธิบายใต้หัวข้อ');
  const items = (addLabel) => itemListEditor(section, kind, { addLabel });

  switch (section.type) {
    case 'links':
      return [heading, items('เพิ่มปุ่ม'),
        advanced('ตั้งค่าเซคชัน', headingAdv,
          segField(section, 'style', 'รูปแบบ', [['list', '1 คอลัมน์'], ['grid', '2 คอลัมน์']]))];
    case 'catalog':
      return [heading, items('เพิ่มสินค้า'),
        advanced('ตั้งค่าเซคชัน', headingAdv,
          h('div', { class: 'grid2' },
            segField(section, 'columns', 'คอลัมน์', [['1', '1'], ['2', '2'], ['3', '3']]),
            textField(section, 'currency', 'สกุลเงิน', { placeholder: 'THB' })))];
    case 'cards':
      return [heading, items('เพิ่มการ์ด'),
        advanced('ตั้งค่าเซคชัน', headingAdv,
          selectField(section, 'layout', 'การวางรูป', [
            ['alternate', 'สลับซ้าย–ขวา'], ['image-left', 'รูปซ้ายทั้งหมด'],
            ['image-right', 'รูปขวาทั้งหมด'], ['stacked', 'รูปบน ข้อความล่าง'],
          ]),
          segField(section, 'columns', 'คอลัมน์', [['1', '1'], ['2', '2']]))];
    case 'gallery':
      return [heading, items('เพิ่มรูป'),
        advanced('ตั้งค่าเซคชัน', headingAdv,
          segField(section, 'display', 'การแสดงผล', [['grid', 'ตาราง'], ['slider', 'เลื่อนข้าง']]),
          segField(section, 'columns', 'คอลัมน์ (เฉพาะตาราง)', [['1', '1'], ['2', '2'], ['3', '3']]),
          selectField(section, 'ratio', 'สัดส่วนรูป', [
            ['square', 'จัตุรัส'], ['portrait', 'แนวตั้ง 3:4'], ['landscape', 'แนวนอน 4:3'], ['auto', 'ตามรูปจริง'],
          ]))];
    case 'video': case 'tiktok': case 'vimeo':
      return [heading, items('เพิ่มคลิป'), advanced('ตั้งค่าเซคชัน', headingAdv)];
    case 'spotify': case 'soundcloud': case 'applemusic':
      return [heading, items('เพิ่มลิงก์เพลง'),
        advanced('ตั้งค่าเซคชัน', headingAdv,
          rangeField(section, 'height', 'ความสูงกล่องเล่นเพลง', { min: 80, max: 600, step: 10, unit: 'px' }))];
    case 'list':
      return [heading, items('เพิ่มรายการ'), advanced('ตั้งค่าเซคชัน', headingAdv)];
    case 'socials':
      return [heading, items('เพิ่มโซเชียล'), advanced('ตั้งค่าเซคชัน', headingAdv)];
    case 'contact':
      return [
        imageField(section, 'avatar', 'รูป'),
        h('div', { class: 'grid2' },
          textField(section, 'name', 'ชื่อ'),
          textField(section, 'role', 'ตำแหน่ง / คำอธิบาย')),
        h('div', { class: 'grid2' },
          textField(section, 'phone', 'เบอร์โทร'),
          textField(section, 'email', 'อีเมล')),
        advanced('ตัวเลือกเพิ่มเติม',
          heading, headingAdv,
          textField(section, 'org', 'บริษัท / แบรนด์'),
          textField(section, 'website', 'เว็บไซต์'),
          textField(section, 'address', 'ที่อยู่'),
          textField(section, 'mapUrl', 'ลิงก์แผนที่'),
          areaField(section, 'note', 'โน้ตเพิ่มเติม', { rows: 2 }),
          checkField(section, 'vcard', 'แสดงปุ่มบันทึกลงรายชื่อติดต่อ'),
          textField(section, 'saveLabel', 'ข้อความบนปุ่มบันทึก')),
      ];
    case 'text':
      return [
        textField(section, 'heading', 'หัวข้อ'),
        areaField(section, 'body', 'ข้อความ', { rows: 4 }),
        segField(section, 'align', 'จัดวาง', [['left', 'ซ้าย'], ['center', 'กลาง'], ['right', 'ขวา']]),
      ];
    case 'embed':
      return [
        textField(section, 'url', 'ลิงก์ iframe (https เท่านั้น)', { sub: 'เช่น ฟอร์ม, ปฏิทินจองคิว, แผนที่' }),
        rangeField(section, 'height', 'ความสูง', { min: 160, max: 900, step: 10, unit: 'px' }),
        advanced('ตั้งค่าเซคชัน', heading, headingAdv),
      ];
    case 'spacer':
      return [
        rangeField(section, 'height', 'ความสูง', { min: 0, max: 120, unit: 'px' }),
        checkField(section, 'divider', 'แสดงเส้นคั่น'),
      ];
    default:
      return [heading, headingAdv];
  }
}

function sectionsTab() {
  const list = h('div');

  const paint = () => {
    list.innerHTML = '';
    if (!state.sections.length) list.append(h('div', { class: 'empty', text: 'ยังไม่มีเซคชัน เพิ่มได้จากปุ่มด้านล่าง' }));

    state.sections.forEach((section, index) => {
      const open = openSections.has(section.id);
      const card = h('div', {
        class: `sec-card${section.visible === false ? ' hidden-sec' : ''}`,
        draggable: 'true',
        dataset: { index: String(index) },
      });

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isNaN(from) || from === index) return;
        const [moved] = state.sections.splice(from, 1);
        state.sections.splice(index, 0, moved);
        touch();
        paint();
      });

      const move = (delta) => {
        const next = index + delta;
        if (next < 0 || next >= state.sections.length) return;
        [state.sections[index], state.sections[next]] = [state.sections[next], state.sections[index]];
        touch();
        paint();
      };

      card.append(h('div', { class: 'sec-bar' },
        h('span', { class: 'grab', title: 'ลากเพื่อสลับลำดับ' }, '⠿'),
        h('div', { class: 'sec-name' },
          h('span', { text: section.title || SECTION_TYPES[section.type] || section.type }),
          h('small', { text: `${SECTION_TYPES[section.type] || section.type}${section.items ? ` · ${section.items.length} รายการ` : ''}` })),
        h('button', {
          class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ซ่อน/แสดง',
          onclick: () => { section.visible = section.visible === false; touch(); paint(); },
        }, section.visible === false ? '🙈' : '👁'),
        h('button', { class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'เลื่อนขึ้น', onclick: () => move(-1) }, '↑'),
        h('button', { class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'เลื่อนลง', onclick: () => move(1) }, '↓'),
        h('button', {
          class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ทำซ้ำ',
          onclick: () => {
            const copy = structuredClone(section);
            copy.id = uid('sec');
            (copy.items || []).forEach((it) => {
              it.id = uid('it');
              (it.links || []).forEach((l) => { l.id = uid('sl'); });
            });
            state.sections.splice(index + 1, 0, copy);
            touch();
            paint();
          },
        }, '⧉'),
        h('button', {
          class: 'btn btn-sm btn-ghost btn-icon', type: 'button', title: 'ลบเซคชัน',
          onclick: () => {
            if (!confirm('ลบเซคชันนี้ทั้งหมด?')) return;
            state.sections.splice(index, 1);
            touch();
            paint();
          },
        }, '🗑'),
        h('button', {
          class: 'btn btn-sm', type: 'button',
          onclick: () => {
            if (open) openSections.delete(section.id); else openSections.add(section.id);
            paint();
          },
        }, open ? 'ปิด' : 'แก้ไข')));

      if (open) card.append(h('div', { class: 'sec-body' }, ...sectionBody(section).filter(Boolean)));
      list.append(card);
    });
  };
  paint();

  const addBlock = (section) => {
    state.sections.push(section);
    openSections.add(section.id);
    (section.items || []).forEach((it) => openItems.add(it.id));
    touch();
    paint();
    // Bring the new block into view — it lands at the bottom of a long list.
    requestAnimationFrame(() => list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const adder = h('div', { class: 'add-row' },
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openBlockPicker(addBlock) }, '+ เพิ่มบล็อก'));

  return [
    h('div', { class: 'panel' },
      h('h3', { text: 'บล็อกในหน้าเว็บ' }),
      h('p', { class: 'hint', text: 'ลากการ์ดหรือกดลูกศรเพื่อสลับลำดับ · กด "แก้ไข" เพื่อเปิดรายละเอียด' }),
      list,
      adder),
  ];
}

/* --------------------------------------------------------- header tab */

function headerTab() {
  const header = state.header;
  const body = h('div');

  const paint = () => {
    body.innerHTML = '';
    fill(body,
      segField(header, 'layout', 'รูปแบบหัวเว็บ', [
        ['cover', 'รูปเต็มจอ'], ['banner', 'แบนเนอร์'], ['avatar', 'รูปกลม'], ['minimal', 'ข้อความ'],
      ], { onChange: paint, sub: header.layout === 'cover' ? 'ชื่อจะทับอยู่บนรูป แบบเดียวกับตัวอย่าง' : '' }),
      header.layout === 'cover' || header.layout === 'banner' ? imageField(header, 'coverImage', 'รูปปก') : null,
      header.layout === 'banner' || header.layout === 'avatar' ? imageField(header, 'avatar', 'รูปโปรไฟล์') : null,
      textField(header, 'title', 'ชื่อ / ชื่อแบรนด์'),
      textField(header, 'subtitle', 'ข้อความรอง'),
      areaField(header, 'bio', 'คำแนะนำตัว', { rows: 2 }),
      advanced('ปรับละเอียด',
        rangeField(header, 'titleSize', 'ขนาดตัวอักษรชื่อ', { min: 22, max: 64, unit: 'px' }),
        segField(header, 'align', 'จัดวางข้อความ', [['center', 'กึ่งกลาง'], ['left', 'ชิดซ้าย']]),
        header.layout === 'cover' ? rangeField(header, 'coverHeight', 'ความสูงรูปปก', { min: 200, max: 700, step: 10, unit: 'px' }) : null,
        header.layout === 'cover' ? rangeField(header, 'overlay', 'ความเข้มเงาทับรูป', { min: 0, max: 1, step: 0.05 }) : null,
        checkField(header, 'showSocials', 'แสดงแถวไอคอนโซเชียลบนหัวเว็บ')));
  };
  paint();

  return [
    h('div', { class: 'panel' }, h('h3', { text: 'หัวเว็บ' }),
      h('p', { class: 'hint', text: 'ส่วนบนสุดของหน้า — รูปปก ชื่อ และคำแนะนำตัว' }), body),
    h('div', { class: 'panel' }, h('h3', { text: 'ไอคอนโซเชียล' }),
      h('p', { class: 'hint', text: 'แถวไอคอนกลมใต้ชื่อ' }),
      itemListEditor(header, 'socials', { addLabel: 'เพิ่มช่องทาง' })),
  ];
}

/* ---------------------------------------------------------- theme tab */

const PRESETS = {
  'ดำคลาสสิก': { bg: '#000000', bgType: 'solid', text: '#ffffff', muted: '#9ca3af', card: '#161616', cardBorder: '#2a2a2a', accent: '#ffffff', accentText: '#000000' },
  'ขาวสะอาด': { bg: '#ffffff', bgType: 'solid', text: '#111827', muted: '#6b7280', card: '#f6f7f9', cardBorder: '#e5e7eb', accent: '#111827', accentText: '#ffffff' },
  'ครีมอบอุ่น': { bg: '#f6efe6', bgType: 'solid', text: '#2a2118', muted: '#7c6a57', card: '#fffaf3', cardBorder: '#e6d8c6', accent: '#b4703a', accentText: '#ffffff' },
  'ไล่สีม่วง': { bg: '#0d0b1a', bgType: 'gradient', bgGradientFrom: '#2b1b55', bgGradientTo: '#0a0916', text: '#ffffff', muted: '#b4a9d6', card: '#1b1733', cardBorder: '#322b58', accent: '#a78bfa', accentText: '#15102b' },
  'มินต์สดใส': { bg: '#061a17', bgType: 'gradient', bgGradientFrom: '#0c3b33', bgGradientTo: '#04110f', text: '#eafff9', muted: '#8fc7ba', card: '#0e2a25', cardBorder: '#1c473e', accent: '#34d399', accentText: '#04231c' },
  'ชมพูพาสเทล': { bg: '#fff5f8', bgType: 'solid', text: '#3b1f2b', muted: '#8b6675', card: '#ffffff', cardBorder: '#f6d9e3', accent: '#ec4899', accentText: '#ffffff' },
};

function themeTab() {
  const theme = state.theme;
  const bgBox = h('div');

  const paintBg = () => {
    bgBox.innerHTML = '';
    fill(bgBox,
      segField(theme, 'bgType', 'ชนิดพื้นหลัง', [
        ['solid', 'สีเดียว'], ['gradient', 'ไล่สี'], ['image', 'รูปภาพ'],
      ], { onChange: paintBg }),
      colorField(theme, 'bg', 'สีพื้นหลัง'),
      theme.bgType === 'gradient' ? h('div', { class: 'grid2' },
        colorField(theme, 'bgGradientFrom', 'ไล่สีจาก'),
        colorField(theme, 'bgGradientTo', 'ไล่สีไป')) : null,
      theme.bgType === 'image' ? imageField(theme, 'bgImage', 'รูปพื้นหลัง') : null,
      theme.bgType === 'image' ? rangeField(theme, 'bgImageDim', 'ความเข้มสีทับรูป', { min: 0, max: 1, step: 0.05 }) : null);
  };
  paintBg();

  const presetRow = h('div', { class: 'preset-row' }, Object.entries(PRESETS).map(([name, preset]) =>
    h('button', {
      class: 'preset', type: 'button', title: name,
      onclick: () => { Object.assign(state.theme, preset); touch(); renderTab(); },
    },
      h('span', {
        class: 'preset-chip',
        style: `background:${preset.bgType === 'gradient'
          ? `linear-gradient(160deg,${preset.bgGradientFrom},${preset.bgGradientTo})` : preset.bg};
          border-color:${preset.cardBorder}`,
      }, h('i', { style: `background:${preset.accent}` }), h('i', { style: `background:${preset.card}` })),
      h('small', { text: name }))));

  return [
    h('div', { class: 'panel' },
      h('h3', { text: 'ชุดสีสำเร็จรูป' }),
      h('p', { class: 'hint', text: 'กดเลือกแล้วดูผลทันทีทางขวา' }),
      presetRow),
    h('div', { class: 'panel' },
      h('h3', { text: 'หน้าตาโดยรวม' }),
      h('p', { class: 'hint', text: '' }),
      selectField(theme, 'font', 'ฟอนต์', Object.entries(FONTS).map(([k, v]) => [k, v.label])),
      segField(theme, 'buttonStyle', 'สไตล์ปุ่ม', [['soft', 'พื้นอ่อน'], ['solid', 'ทึบ'], ['outline', 'เส้นขอบ']]),
      rangeField(theme, 'radius', 'ความมนของมุม', { min: 0, max: 36, unit: 'px' }),
      advanced('ปรับละเอียด',
        rangeField(theme, 'maxWidth', 'ความกว้างสูงสุดของหน้า', { min: 380, max: 900, step: 10, unit: 'px' }),
        checkField(theme, 'cardShadow', 'ใส่เงาให้การ์ด'))),
    h('div', { class: 'panel' }, h('h3', { text: 'พื้นหลัง' }), bgBox),
    h('div', { class: 'panel' },
      h('h3', { text: 'สีแต่ละส่วน' }),
      h('p', { class: 'hint', text: 'เปิดเมื่ออยากจูนเองทีละสี' }),
      advanced('ปรับสีเอง',
        h('div', { class: 'grid2' },
          colorField(theme, 'text', 'สีตัวอักษร'),
          colorField(theme, 'muted', 'สีตัวอักษรรอง'),
          colorField(theme, 'card', 'สีพื้นการ์ด/ปุ่ม'),
          colorField(theme, 'cardBorder', 'สีเส้นขอบ'),
          colorField(theme, 'accent', 'สีหลัก (ปุ่มเด่น/ป้าย)'),
          colorField(theme, 'accentText', 'สีตัวอักษรบนสีหลัก')))),
  ];
}

/* ------------------------------------------------------- settings tab */

function settingsTab() {
  const site = state.site;

  const pwMsg = h('div');
  const pwCurrent = h('input', { type: 'password', autocomplete: 'current-password' });
  const pwNext = h('input', { type: 'password', autocomplete: 'new-password' });

  const uploadsBox = h('div', { class: 'up-grid' });
  const loadUploads = async () => {
    uploadsBox.innerHTML = '';
    try {
      const { files } = await api('/api/uploads');
      if (!files.length) { uploadsBox.append(h('div', { class: 'empty', text: 'ยังไม่มีไฟล์ที่อัปโหลด' })); return; }
      for (const f of files) {
        uploadsBox.append(h('div', { class: 'up-item' },
          h('img', { src: f.url, alt: '', title: `${(f.size / 1024).toFixed(0)} KB`, onclick: () => { navigator.clipboard?.writeText(f.url); toast('คัดลอกลิงก์รูปแล้ว', 'ok'); } }),
          h('button', {
            type: 'button', title: 'ลบไฟล์',
            onclick: async () => {
              if (!confirm('ลบไฟล์นี้? รูปที่ใช้อยู่จะหายไปด้วย')) return;
              await api('/api/uploads', { method: 'DELETE', body: { url: f.url } });
              loadUploads();
            },
          }, '✕')));
      }
    } catch (err) {
      uploadsBox.append(h('div', { class: 'msg msg-err', text: err.message }));
    }
  };
  loadUploads();

  const importFile = h('input', { type: 'file', accept: 'application/json', class: 'hidden' });
  importFile.addEventListener('change', async () => {
    const f = importFile.files?.[0];
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      if (!parsed || !Array.isArray(parsed.sections)) throw new Error('ไฟล์ไม่ใช่ข้อมูลของ LinkHub');
      delete parsed.auth;
      state = { ...state, ...parsed, stats: state.stats };
      touch();
      renderTab();
      toast('นำเข้าแล้ว อย่าลืมกดบันทึก', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      importFile.value = '';
    }
  });

  return [
    h('div', { class: 'panel' },
      h('h3', { text: 'SEO และการแชร์' }),
      h('p', { class: 'hint', text: 'ข้อความและรูปที่โชว์บน Google และตอนแปะลิงก์ลงแชต' }),
      textField(site, 'metaTitle', 'ชื่อหน้า (title)'),
      areaField(site, 'metaDescription', 'คำอธิบายหน้า', { rows: 2 }),
      imageField(site, 'ogImage', 'รูปตอนแชร์ลิงก์', { sub: 'แนะนำ 1200 × 630 px' }),
      advanced('ตัวเลือกเพิ่มเติม',
        imageField(site, 'favicon', 'ไอคอนแท็บเบราว์เซอร์'),
        textField(site, 'footerText', 'ข้อความท้ายหน้า'),
        checkField(site, 'showCredit', 'แสดงเครดิต "สร้างด้วย LinkHub"'))),
    h('div', { class: 'panel' },
      h('h3', { text: 'Tracking และโค้ดเสริม' }),
      h('p', { class: 'hint', text: 'ใส่เฉพาะ ID ไม่ต้องใส่โค้ดทั้งก้อน' }),
      advanced('ใส่ ID / CSS',
        h('div', { class: 'grid3' },
          textField(site, 'gaId', 'Google Analytics', { placeholder: 'G-XXXXXXX' }),
          textField(site, 'metaPixelId', 'Meta Pixel', { placeholder: '1234567890' }),
          textField(site, 'tiktokPixelId', 'TikTok Pixel', { placeholder: 'CXXXXXXXXXX' })),
        areaField(site, 'customCss', 'CSS เพิ่มเติม', { rows: 4, sub: 'สำหรับคนที่อยากปรับละเอียด' }))),
    h('div', { class: 'panel' },
      h('h3', { text: 'คลังรูปที่อัปโหลด' }),
      h('p', { class: 'hint', text: 'คลิกที่รูปเพื่อคัดลอกลิงก์' }),
      uploadsBox,
      h('div', { class: 'add-row' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: loadUploads }, 'รีเฟรช'))),
    h('div', { class: 'panel' },
      h('h3', { text: 'สำรองข้อมูล' }),
      h('p', { class: 'hint', text: 'ดาวน์โหลดเก็บไว้ก่อนแก้ใหญ่ ๆ จะปลอดภัยที่สุด' }),
      h('div', { class: 'add-row' },
        h('button', {
          class: 'btn btn-sm', type: 'button',
          onclick: () => {
            const blob = new Blob([JSON.stringify({ ...state, stats: undefined }, null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `linkhub-${new Date().toISOString().slice(0, 10)}.json` });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          },
        }, 'ดาวน์โหลดไฟล์สำรอง'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => importFile.click() }, 'นำเข้าไฟล์สำรอง'),
        importFile)),
    h('div', { class: 'panel' },
      h('h3', { text: 'เปลี่ยนรหัสผ่าน' }),
      h('p', { class: 'hint', text: 'รหัสที่ใช้เข้าหลังบ้านนี้' }),
      session.canChangePassword === false ? h('div', { class: 'msg msg-warn' },
        'เว็บนี้รันบน Vercel รหัสผ่านเก็บไว้ที่ Environment Variable — เปลี่ยนได้ที่ Vercel → Settings → Environment Variables → ADMIN_PASSWORD แล้วกด Redeploy') : null,
      pwMsg,
      session.canChangePassword === false ? null : wrapField('รหัสผ่านปัจจุบัน', pwCurrent),
      session.canChangePassword === false ? null : wrapField('รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)', pwNext),
      session.canChangePassword === false ? null : h('button', {
        class: 'btn btn-primary btn-sm', type: 'button',
        onclick: async () => {
          pwMsg.innerHTML = '';
          try {
            await api('/api/password', { method: 'POST', body: { current: pwCurrent.value, next: pwNext.value } });
            pwCurrent.value = pwNext.value = '';
            pwMsg.append(h('div', { class: 'msg msg-ok', text: 'เปลี่ยนรหัสผ่านเรียบร้อย' }));
            toast('เปลี่ยนรหัสผ่านแล้ว', 'ok');
          } catch (err) {
            pwMsg.append(h('div', { class: 'msg msg-err', text: err.message }));
          }
        },
      }, 'บันทึกรหัสผ่านใหม่')),
  ];
}

/* ---------------------------------------------------------- stats tab */

function labelIndex() {
  const map = new Map();
  for (const s of state.header.socials || []) map.set(s.id, `โซเชียลหัวเว็บ · ${s.label || s.platform}`);
  for (const sec of state.sections || []) {
    for (const item of sec.items || []) {
      map.set(item.id, `${sec.title || SECTION_TYPES[sec.type] || sec.type} · ${itemLabel(item, sec.type)}`);
    }
  }
  return map;
}

function statsTab() {
  const box = h('div');

  const paint = async () => {
    box.innerHTML = '';
    let stats;
    try {
      stats = await api('/api/stats');
    } catch (err) {
      box.append(h('div', { class: 'msg msg-err', text: err.message }));
      return;
    }
    const labels = labelIndex();
    const days = Object.keys(stats.daily || {}).sort().slice(-14);
    const max = Math.max(1, ...days.map((d) => stats.daily[d].views || 0));
    const totalClicks = Object.values(stats.clicks || {}).reduce((a, b) => a + b, 0);
    const rows = Object.entries(stats.clicks || {}).sort((a, b) => b[1] - a[1]);

    box.append(
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('b', { text: String(stats.views || 0) }), h('span', { text: 'คนเข้าชมทั้งหมด' })),
        h('div', { class: 'stat' }, h('b', { text: String(totalClicks) }), h('span', { text: 'คลิกทั้งหมด' })),
        h('div', { class: 'stat' }, h('b', { text: `${stats.views ? Math.round((totalClicks / stats.views) * 100) : 0}%` }), h('span', { text: 'อัตราการคลิก' }))),
      h('h4', { style: 'font-size:13px;margin-top:6px', text: 'ผู้เข้าชม 14 วันล่าสุด' }),
      h('div', { class: 'bars' }, days.map((d) => h('div', {
        style: `height:${Math.round(((stats.daily[d].views || 0) / max) * 100)}%`,
        title: `${d} · ${stats.daily[d].views || 0} views / ${stats.daily[d].clicks || 0} clicks`,
      }))),
      h('div', { class: 'bars-x' },
        h('span', { text: days[0] || '' }),
        h('span', { text: days[days.length - 1] || '' })),
      h('h4', { style: 'font-size:13px;margin-top:18px', text: 'คลิกรายลิงก์' }),
      rows.length ? h('table', { class: 'stats' },
        h('thead', {}, h('tr', {}, h('th', { text: 'ลิงก์' }), h('th', { text: 'คลิก' }))),
        h('tbody', {}, rows.map(([id, count]) =>
          h('tr', {}, h('td', { text: labels.get(id) || `(ถูกลบแล้ว) ${id}` }), h('td', { text: String(count) })))))
        : h('div', { class: 'empty', text: 'ยังไม่มีคลิก' }),
      h('div', { class: 'add-row' },
        h('button', { class: 'btn btn-sm', type: 'button', onclick: paint }, 'รีเฟรช'),
        h('button', {
          class: 'btn btn-sm btn-danger', type: 'button',
          onclick: async () => {
            if (!confirm('ล้างสถิติทั้งหมด?')) return;
            await api('/api/stats', { method: 'DELETE' });
            paint();
          },
        }, 'ล้างสถิติ')),
    );
  };
  paint();

  return [h('div', { class: 'panel' },
    h('h3', { text: 'สถิติ' }),
    h('p', { class: 'hint', text: 'นับจากหน้าเว็บจริงเท่านั้น (ตัวอย่างในหลังบ้านไม่ถูกนับ)' }),
    box)];
}

/* ------------------------------------------------------------- shell */

const TABS = [
  ['header', 'หัวเว็บ'],
  ['sections', 'บล็อก'],
  ['theme', 'ธีม'],
  ['stats', 'สถิติ'],
  ['settings', 'ตั้งค่า'],
];

function renderTabs() {
  const nav = $('#tabs');
  nav.innerHTML = '';
  for (const [key, label] of TABS) {
    nav.append(h('button', {
      class: `tab${activeTab === key ? ' active' : ''}`, type: 'button',
      onclick: () => { activeTab = key; renderTabs(); renderTab(); },
    }, label));
  }
}

function renderTab() {
  const host = $('#panel-content');
  host.innerHTML = '';
  const views = { header: headerTab, sections: sectionsTab, theme: themeTab, stats: statsTab, settings: settingsTab };
  host.append(...(views[activeTab] || headerTab)());
}

async function save() {
  try {
    $('#btn-save').disabled = true;
    await api('/api/data', { method: 'PUT', body: { ...state, stats: undefined } });
    dirty = false;
    updateSaveState();
    toast('บันทึกเรียบร้อย', 'ok');
  } catch (err) {
    toast(err.message, 'err');
    $('#btn-save').disabled = false;
  }
}

function showLogin(message) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  if (message) $('#login-msg').innerHTML = `<div class="msg msg-err">${message}</div>`;
}

async function boot() {
  session = await api('/api/session');
  if (!session.authed) { showLogin(); return; }
  state = await api('/api/data');
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  if (session.isDefaultPassword) {
    $('#panel-content').before(h('div', { class: 'msg msg-warn', text: 'คุณยังใช้รหัสผ่านเริ่มต้นอยู่ — ไปที่แท็บ "ตั้งค่า" เพื่อเปลี่ยนรหัสผ่านก่อนใช้งานจริง' }));
  }
  dirty = false;
  updateSaveState();
  renderTabs();
  renderTab();
  renderPreview();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-msg').innerHTML = '';
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#login-pw').value } });
    $('#login-pw').value = '';
    await boot();
  } catch (err) {
    $('#login-msg').innerHTML = `<div class="msg msg-err">${err.message}</div>`;
  }
});

$('#btn-save').addEventListener('click', save);
$('#btn-reload').addEventListener('click', renderPreview);
$('#btn-wide').addEventListener('click', () => $('#preview-wrap').classList.toggle('wide'));
$('#btn-logout').addEventListener('click', async () => {
  if (dirty && !confirm('ยังมีการแก้ไขที่ยังไม่บันทึก ออกจากระบบเลยไหม?')) return;
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (dirty) save();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

boot().catch(() => showLogin());
