import { renderPage, FONTS, ICONS, SOCIAL_PLATFORMS, SECTION_TYPES } from '/shared/render.mjs';

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

/* --------------------------------------------------------------- state */

let state = null;
let dirty = false;
let activeTab = 'sections';
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

const ITEM_FIELDS = {
  links: (item, rerender) => [
    textField(item, 'title', 'ชื่อปุ่ม', { placeholder: 'เช่น ติดต่องาน : ทาง LINE OA' }),
    textField(item, 'subtitle', 'คำอธิบายใต้ชื่อ', { placeholder: 'ไม่ใส่ก็ได้' }),
    textField(item, 'url', 'ลิงก์', { placeholder: 'https://…' }),
    h('div', { class: 'grid2' },
      selectField(item, 'iconType', 'แบบไอคอน', [
        ['icon', 'ไอคอนสำเร็จรูป'], ['image', 'รูปภาพ'], ['emoji', 'อีโมจิ'], ['none', 'ไม่มีไอคอน'],
      ], { onChange: rerender }),
      textField(item, 'badge', 'ป้ายเล็ก (badge)', { placeholder: 'เช่น ใหม่' })),
    item.iconType === 'image' ? imageField(item, 'image', 'รูปไอคอน')
      : item.iconType === 'emoji' ? textField(item, 'emoji', 'อีโมจิ', { placeholder: '🔥' })
        : item.iconType === 'none' ? null : iconField(item, 'icon', 'เลือกไอคอน'),
    checkField(item, 'highlight', 'เน้นปุ่มนี้ (ตีกรอบสีหลัก)'),
  ],
  cards: (item) => [
    imageField(item, 'image', 'รูปการ์ด', { sub: 'แนะนำรูปแนวนอน อัตราส่วนราว 4:3' }),
    areaField(item, 'title', 'หัวข้อ', { rows: 2, placeholder: 'ชื่อสินค้า / ชื่อคลาส' }),
    areaField(item, 'subtitle', 'คำอธิบาย', { rows: 2 }),
    h('div', { class: 'grid3' },
      textField(item, 'price', 'ราคา', { placeholder: 'เช่น 1,290.-' }),
      textField(item, 'badge', 'ป้ายเล็ก', { placeholder: 'ขายดี' }),
      textField(item, 'cta', 'ข้อความปุ่ม', { placeholder: 'กดสั่งเลย' })),
    textField(item, 'url', 'ลิงก์', { placeholder: 'https://…' }),
  ],
  gallery: (item) => [
    imageField(item, 'image', 'รูป'),
    textField(item, 'caption', 'คำบรรยาย'),
    textField(item, 'url', 'ลิงก์ (ไม่ใส่ก็ได้)'),
  ],
  video: (item) => [
    textField(item, 'title', 'ชื่อคลิป'),
    textField(item, 'url', 'ลิงก์ YouTube', { sub: 'ใส่ลิงก์ปกติ, Shorts หรือ youtu.be ก็ได้' }),
  ],
  socials: (item) => [
    selectField(item, 'platform', 'แพลตฟอร์ม', SOCIAL_PLATFORMS),
    textField(item, 'url', 'ลิงก์ / อีเมล', { placeholder: 'https://… หรือ name@mail.com' }),
    textField(item, 'label', 'ชื่อเรียก (สำหรับ accessibility)'),
  ],
};

function newItem(type) {
  const base = { id: uid('it'), visible: true };
  if (type === 'links') return { ...base, title: 'ปุ่มใหม่', subtitle: '', url: '', iconType: 'icon', icon: 'link' };
  if (type === 'cards') return { ...base, title: 'รายการใหม่', subtitle: '', image: '', url: '', cta: 'ดูเลย' };
  if (type === 'gallery') return { ...base, image: '', caption: '', url: '' };
  if (type === 'video') return { ...base, title: '', url: '' };
  if (type === 'socials') return { ...base, platform: 'instagram', url: '', label: '' };
  return base;
}

function itemLabel(item, type) {
  if (type === 'socials') return item.label || item.platform || 'โซเชียล';
  if (type === 'gallery') return item.caption || 'รูปภาพ';
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
  if (type === 'links') return { ...base, title: 'ลิงก์ของฉัน', style: 'list', items: [newItem('links')] };
  if (type === 'cards') return { ...base, title: 'แนะนำ', layout: 'alternate', columns: 1, items: [newItem('cards')] };
  if (type === 'gallery') return { ...base, title: 'แกลเลอรี', columns: 2, ratio: 'square', items: [newItem('gallery')] };
  if (type === 'video') return { ...base, title: 'คลิปล่าสุด', items: [newItem('video')] };
  if (type === 'text') return { ...base, heading: 'หัวข้อ', body: 'ข้อความของคุณ', align: 'center' };
  if (type === 'socials') return { ...base, title: '', items: [newItem('socials')] };
  if (type === 'embed') return { ...base, title: '', url: '', height: 420 };
  if (type === 'spacer') return { ...base, height: 24, divider: true };
  return base;
}

function sectionBody(section) {
  const common = [
    textField(section, 'title', 'หัวข้อเซคชัน', { placeholder: 'ไม่ใส่ก็ได้' }),
    textField(section, 'subtitle', 'คำอธิบายใต้หัวข้อ'),
  ];
  switch (section.type) {
    case 'links':
      return [...common,
        selectField(section, 'style', 'รูปแบบ', [['list', 'เรียงเต็มกว้าง'], ['grid', '2 คอลัมน์']]),
        itemListEditor(section, 'links', { addLabel: 'เพิ่มปุ่ม' })];
    case 'cards':
      return [...common,
        h('div', { class: 'grid2' },
          selectField(section, 'layout', 'การวางรูป', [
            ['alternate', 'สลับซ้าย–ขวา'], ['image-left', 'รูปซ้ายทั้งหมด'],
            ['image-right', 'รูปขวาทั้งหมด'], ['stacked', 'รูปบน ข้อความล่าง'],
          ]),
          selectField(section, 'columns', 'จำนวนคอลัมน์', [['1', '1 คอลัมน์'], ['2', '2 คอลัมน์']])),
        itemListEditor(section, 'cards', { addLabel: 'เพิ่มการ์ด' })];
    case 'gallery':
      return [...common,
        h('div', { class: 'grid2' },
          selectField(section, 'columns', 'คอลัมน์', [['1', '1'], ['2', '2'], ['3', '3']]),
          selectField(section, 'ratio', 'สัดส่วนรูป', [
            ['square', 'จัตุรัส'], ['portrait', 'แนวตั้ง 3:4'], ['landscape', 'แนวนอน 4:3'], ['auto', 'ตามรูปจริง'],
          ])),
        itemListEditor(section, 'gallery', { addLabel: 'เพิ่มรูป' })];
    case 'video':
      return [...common, itemListEditor(section, 'video', { addLabel: 'เพิ่มคลิป' })];
    case 'socials':
      return [...common, itemListEditor(section, 'socials', { addLabel: 'เพิ่มโซเชียล' })];
    case 'text':
      return [
        textField(section, 'heading', 'หัวข้อ'),
        areaField(section, 'body', 'ข้อความ', { rows: 4 }),
        selectField(section, 'align', 'จัดวาง', [['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง'], ['right', 'ชิดขวา']]),
      ];
    case 'embed':
      return [...common,
        textField(section, 'url', 'ลิงก์ iframe (https เท่านั้น)', { sub: 'เช่น ปฏิทินจอง, ฟอร์ม, Spotify embed' }),
        rangeField(section, 'height', 'ความสูง', { min: 160, max: 900, step: 10, unit: 'px' })];
    case 'spacer':
      return [
        rangeField(section, 'height', 'ความสูง', { min: 0, max: 120, unit: 'px' }),
        checkField(section, 'divider', 'แสดงเส้นคั่น'),
      ];
    default:
      return common;
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
            (copy.items || []).forEach((it) => { it.id = uid('it'); });
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

  const adder = h('div', { class: 'add-row' }, Object.entries(SECTION_TYPES).map(([type, label]) =>
    h('button', {
      class: 'btn btn-sm', type: 'button',
      onclick: () => {
        const section = newSection(type);
        state.sections.push(section);
        openSections.add(section.id);
        (section.items || []).forEach((it) => openItems.add(it.id));
        touch();
        paint();
      },
    }, `+ ${label}`)));

  return [
    h('div', { class: 'panel' },
      h('h3', { text: 'เซคชันของหน้าเว็บ' }),
      h('p', { class: 'hint', text: 'ลากการ์ดหรือกดลูกศรเพื่อสลับลำดับ กด "แก้ไข" เพื่อเปิดรายละเอียด' }),
      list,
      h('h4', { style: 'margin:16px 0 0;font-size:13px', text: 'เพิ่มเซคชันใหม่' }),
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
      selectField(header, 'layout', 'รูปแบบหัวเว็บ', [
        ['cover', 'รูปเต็มจอ + ชื่อทับรูป (แบบตัวอย่าง)'],
        ['banner', 'แบนเนอร์ + รูปโปรไฟล์กลม'],
        ['avatar', 'รูปโปรไฟล์กลมอย่างเดียว'],
        ['minimal', 'ข้อความล้วน'],
      ], { onChange: () => { paint(); } }),
      header.layout === 'cover' || header.layout === 'banner' ? imageField(header, 'coverImage', 'รูปปก') : null,
      header.layout === 'cover' ? rangeField(header, 'coverHeight', 'ความสูงรูปปก', { min: 200, max: 700, step: 10, unit: 'px' }) : null,
      header.layout === 'cover' ? rangeField(header, 'overlay', 'ความเข้มเงาทับรูป', { min: 0, max: 1, step: 0.05 }) : null,
      header.layout === 'banner' || header.layout === 'avatar' ? imageField(header, 'avatar', 'รูปโปรไฟล์') : null,
      textField(header, 'title', 'ชื่อ / ชื่อแบรนด์'),
      rangeField(header, 'titleSize', 'ขนาดตัวอักษรชื่อ', { min: 22, max: 64, unit: 'px' }),
      areaField(header, 'subtitle', 'ข้อความรอง', { rows: 2 }),
      areaField(header, 'bio', 'คำแนะนำตัว', { rows: 3 }),
      selectField(header, 'align', 'จัดวางข้อความ', [['center', 'กึ่งกลาง'], ['left', 'ชิดซ้าย']]),
      checkField(header, 'showSocials', 'แสดงแถวไอคอนโซเชียลบนหัวเว็บ'),
    );
  };
  paint();

  return [
    h('div', { class: 'panel' }, h('h3', { text: 'หัวเว็บ (Header)' }),
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
      selectField(theme, 'bgType', 'ชนิดพื้นหลัง', [
        ['solid', 'สีเดียว'], ['gradient', 'ไล่สี'], ['image', 'รูปภาพ'],
      ], { onChange: () => paintBg() }),
      colorField(theme, 'bg', 'สีพื้นหลังหลัก'),
      theme.bgType === 'gradient' ? h('div', { class: 'grid2' },
        colorField(theme, 'bgGradientFrom', 'ไล่สีจาก'),
        colorField(theme, 'bgGradientTo', 'ไล่สีไป')) : null,
      theme.bgType === 'image' ? imageField(theme, 'bgImage', 'รูปพื้นหลัง') : null,
      theme.bgType === 'image' ? rangeField(theme, 'bgImageDim', 'ความเข้มสีทับรูป', { min: 0, max: 1, step: 0.05 }) : null,
    );
  };
  paintBg();

  const presetRow = h('div', { class: 'add-row' }, Object.entries(PRESETS).map(([name, preset]) =>
    h('button', {
      class: 'btn btn-sm', type: 'button',
      onclick: () => { Object.assign(state.theme, preset); touch(); renderTab(); },
    }, name)));

  return [
    h('div', { class: 'panel' },
      h('h3', { text: 'ชุดสีสำเร็จรูป' }),
      h('p', { class: 'hint', text: 'กดเลือกเพื่อเปลี่ยนทั้งชุด แล้วค่อยปรับทีละสีด้านล่างได้' }),
      presetRow),
    h('div', { class: 'panel' }, h('h3', { text: 'พื้นหลัง' }), bgBox),
    h('div', { class: 'panel' },
      h('h3', { text: 'สี' }),
      h('div', { class: 'grid2' },
        colorField(theme, 'text', 'สีตัวอักษร'),
        colorField(theme, 'muted', 'สีตัวอักษรรอง'),
        colorField(theme, 'card', 'สีพื้นการ์ด/ปุ่ม'),
        colorField(theme, 'cardBorder', 'สีเส้นขอบ'),
        colorField(theme, 'accent', 'สีหลัก (ปุ่มเด่น/ป้าย)'),
        colorField(theme, 'accentText', 'สีตัวอักษรบนสีหลัก'))),
    h('div', { class: 'panel' },
      h('h3', { text: 'ตัวอักษรและรูปทรง' }),
      selectField(theme, 'font', 'ฟอนต์', Object.entries(FONTS).map(([k, v]) => [k, v.label])),
      selectField(theme, 'buttonStyle', 'สไตล์ปุ่ม', [
        ['soft', 'พื้นอ่อน (soft)'], ['solid', 'ทึบสีหลัก (solid)'], ['outline', 'เส้นขอบ (outline)'],
      ]),
      rangeField(theme, 'radius', 'ความมนของมุม', { min: 0, max: 36, unit: 'px' }),
      rangeField(theme, 'maxWidth', 'ความกว้างสูงสุดของหน้า', { min: 380, max: 900, step: 10, unit: 'px' }),
      checkField(theme, 'cardShadow', 'ใส่เงาให้การ์ด')),
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
      h('p', { class: 'hint', text: 'ข้อความที่โชว์บน Google และตอนแปะลิงก์ลงแชต' }),
      textField(site, 'metaTitle', 'ชื่อหน้า (title)'),
      areaField(site, 'metaDescription', 'คำอธิบายหน้า', { rows: 2 }),
      imageField(site, 'ogImage', 'รูปตอนแชร์ลิงก์ (OG image)', { sub: 'แนะนำ 1200 × 630 px' }),
      imageField(site, 'favicon', 'ไอคอนแท็บเบราว์เซอร์')),
    h('div', { class: 'panel' },
      h('h3', { text: 'ท้ายหน้าและโค้ดเสริม' }),
      textField(site, 'footerText', 'ข้อความท้ายหน้า'),
      checkField(site, 'showCredit', 'แสดงเครดิต "สร้างด้วย LinkHub"'),
      areaField(site, 'customCss', 'CSS เพิ่มเติม', { rows: 4, sub: 'สำหรับคนที่อยากปรับละเอียด' })),
    h('div', { class: 'panel' },
      h('h3', { text: 'Tracking' }),
      h('p', { class: 'hint', text: 'ใส่เฉพาะ ID ไม่ต้องใส่โค้ดทั้งก้อน' }),
      h('div', { class: 'grid3' },
        textField(site, 'gaId', 'Google Analytics', { placeholder: 'G-XXXXXXX' }),
        textField(site, 'metaPixelId', 'Meta Pixel', { placeholder: '1234567890' }),
        textField(site, 'tiktokPixelId', 'TikTok Pixel', { placeholder: 'CXXXXXXXXXX' }))),
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
      pwMsg,
      wrapField('รหัสผ่านปัจจุบัน', pwCurrent),
      wrapField('รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)', pwNext),
      h('button', {
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
  ['sections', 'เซคชัน'],
  ['header', 'หัวเว็บ'],
  ['theme', 'ธีม'],
  ['settings', 'ตั้งค่า'],
  ['stats', 'สถิติ'],
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
  const views = { sections: sectionsTab, header: headerTab, theme: themeTab, settings: settingsTab, stats: statsTab };
  host.append(...(views[activeTab] || sectionsTab)());
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
  const session = await api('/api/session');
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
