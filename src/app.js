/* ═══════════════════════════════════════════════════════════════════════════════
   Полосатор — Premium Bonus layouts with stripes.
   Map of this file:
     1. constants: formats, layouts, themes, controls schema
     2. state + persistence
     3. fonts and text blocks (opentype paths, the same for canvas and SVG)
     4. scene: layout rects, strips, photo and logo frames
     5. canvas renderer, SVG writer
     6. UI: panel, gallery, canvas interactions, playback
     7. export: PNG, SVG, MP4/WebM, GIF
   The engine (stripe generators and presets) lives in engine.js, concatenated before this file.
   ═══════════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const comma = (v, d = 1) => v.toFixed(d).replace('.', ',');
const pct = v => Math.round(v * 100) + ' %';
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const breathe = () => new Promise(r => setTimeout(r, 0));

/* ───────────────────────── 1. constants ───────────────────────── */
const FORMATS = [
  { id: 'slide', name: '16:9', w: 1920, h: 1080, hint: 'слайд, обложка видео' },
  { id: 'banner', name: 'Баннер', w: 1800, h: 800, hint: 'обложка вебинара, сайт' },
  { id: 'square', name: '1:1', w: 1080, h: 1080, hint: 'пост' },
  { id: 'post', name: '4:5', w: 1080, h: 1350, hint: 'пост в ленте' },
  { id: 'stories', name: '9:16', w: 1080, h: 1920, hint: 'сторис, рилс' },
];
const LAYOUTS = [
  { id: 'right', name: 'Полосы справа' },
  { id: 'left', name: 'Полосы слева' },
  { id: 'bottom', name: 'Полосы снизу' },
  { id: 'top', name: 'Полосы сверху' },
  { id: 'full', name: 'На весь кадр' },
  { id: 'card', name: 'Карточка' },
];
const THEMES = [
  { id: 'violet', name: 'Фиолетовый', bg: '#A872FF', ink: '#FFFFFF', card: '#5A2BE0', p: ['#76DEFE', '#FFA3E9', '#FFC568'] },
  { id: 'violet-sun', name: 'Фиолет и абрикос', bg: '#A872FF', ink: '#FFFFFF', card: '#5A2BE0', p: ['#FFC568', '#FFA3E9', '#76DEFE'] },
  { id: 'white', name: 'Белый', bg: '#FFFFFF', ink: '#16121F', card: '#F0EAFF', p: ['#A872FF', '#5A2BE0', '#FFA3E9'] },
  { id: 'white-card', name: 'Белый, карточка', bg: '#FFFFFF', ink: '#16121F', card: '#A872FF', p: ['#76DEFE', '#FFA3E9', '#FFC568'] },
  { id: 'night', name: 'Ночь', bg: '#130D26', ink: '#FFFFFF', card: '#221844', p: ['#A872FF', '#76DEFE', '#FFA3E9'] },
  { id: 'mint', name: 'Ночь и мята', bg: '#130D26', ink: '#FFFFFF', card: '#221844', p: ['#7EF0C9', '#76DEFE', '#A872FF'] },
  { id: 'ultra', name: 'Ультрафиолет', bg: '#5A2BE0', ink: '#FFFFFF', card: '#3D1BA8', p: ['#FFA3E9', '#FFC568', '#76DEFE'] },
  { id: 'lavender', name: 'Лаванда', bg: '#EFE8FF', ink: '#16121F', card: '#FFFFFF', p: ['#A872FF', '#FFA3E9', '#76DEFE'] },
  { id: 'graphite', name: 'Графит', bg: '#18161E', ink: '#FFFFFF', card: '#26232E', p: ['#FFC568', '#FFA3E9', '#A872FF'] },
  { id: 'sky', name: 'Голубой', bg: '#76DEFE', ink: '#16121F', card: '#FFFFFF', p: ['#A872FF', '#5A2BE0', '#FFFFFF'] },
  { id: 'pink', name: 'Розовый', bg: '#FFA3E9', ink: '#16121F', card: '#FFFFFF', p: ['#A872FF', '#5A2BE0', '#FFC568'] },
  { id: 'apricot', name: 'Абрикос', bg: '#FFC568', ink: '#16121F', card: '#FFFFFF', p: ['#A872FF', '#FFA3E9', '#5A2BE0'] },
];
const SWATCHES = ['#A872FF', '#FFA3E9', '#FFC568', '#76DEFE', '#FFFFFF', '#5A2BE0', '#3D1BA8', '#EFE8FF', '#7EF0C9', '#FF8E7A', '#130D26', '#16121F'];
const COLOR_MODES = [['solid', 'Один цвет'], ['duo', 'Два цвета'], ['spectrum', 'Перелив'], ['sweep', 'Градиент'], ['alt', 'Чередование']];
const COLOR_NOTES = {
  solid: 'Все полосы цветом «Полосы 1».',
  duo: 'Приём сам решает, где второй цвет: верх лесенки, изнанка ленты, соседние кольца.',
  spectrum: 'Каждая полоса берёт свой оттенок из трёх цветов, от первой к последней.',
  sweep: 'Один градиент из трёх цветов поверх всех полос, вдоль их направления.',
  alt: 'Цвета 1, 2 и 3 по очереди.',
};

/* controls for the "Приём" tab; `gens` limits where a control appears, `show` hides it by state */
const ALL = ['lines', 'surface'];
const LIN = ['lines'], SRF = ['surface'];
const deg = v => Math.round(v) + '°';
const times = v => (v === 0 ? 'стоит' : (v > 0 ? '' : '−') + '×' + Math.abs(v));
const x2 = v => comma(v, 2);
const KINDS = [['conoid', 'Коноид'], ['cylindroid', 'Цилиндроид'], ['hypar', 'Косая плоскость'], ['fan', 'Веер'], ['torse', 'Торс'], ['helicoid', 'Геликоид'],
  ['translation', 'Перенос'], ['relief', 'Рельеф'], ['saddle', 'Седло'], ['fold', 'Гармошка'], ['plucker', 'Плюккер'], ['wave', 'Волна']];
/* what A, B, C and f mean for each surface */
const KIND_UI = {
  conoid: { A: 'Высота волны', B: 'Раскрытие веера', f: 'Волн на направляющей', wform: true, about: 'Коноид: прямые от одной прямой к кривой, все параллельны одной плоскости.' },
  cylindroid: { A: 'Волна верхней кривой', B: 'Волна нижней кривой', C: 'Сдвиг между кривыми', f: 'Волн', wform: true, about: 'Цилиндроид: прямые между двумя разными кривыми.' },
  hypar: { A: 'Дыхание седла', B: 'Кривизна', C: 'Наклон', about: 'Гиперболический параболоид: седло из двух семейств прямых.' },
  fan: { A: 'Волна направляющей', B: 'Положение вершины', C: 'Отступ от вершины', f: 'Волн', wform: true, about: 'Коническая поверхность: все прямые проходят через одну вершину.' },
  torse: { A: 'Изгиб кривой', B: 'Кручение кривой', C: 'Длина образующих', about: 'Торс: касательные к пространственной кривой, с ребром возврата.' },
  helicoid: { A: 'Ширина', B: 'Полуоборотов', C: 'Начальный поворот', about: 'Геликоид: прямые поворачиваются вдоль оси.' },
  translation: { A: 'Высота профиля', B: 'Прогиб пути', C: 'Наклон', f: 'Волн профиля', about: 'Поверхность переноса: профиль скользит по параболе.' },
  relief: { A: 'Высота', B: 'Ширина холма', C: 'Глубина впадины', about: 'Рельеф: лист с холмом и впадиной, которые ходят по кругу цикла.' },
  saddle: { A: 'Высота', B: 'Перекос', about: 'Кубическое седло: z = x³ − 3xy², три гребня и три впадины.' },
  fold: { A: 'Глубина складок', B: 'Наклон листа', C: 'Скос складок', f: 'Складок', about: 'Складки: лист с острыми изломами, полосы делятся на плоскости.' },
  plucker: { A: 'Высота', B: 'Доля оборота', about: 'Коноид Плюккера: прямые через одну ось, высота по закону sin 2θ.' },
  wave: { A: 'Высота волны', B: 'Вторая волна', C: 'Сдвиг волны поперёк', f: 'Волн', about: 'Волна: лист, по которому бегут две волны.' },
};
const kui = g => KIND_UI[g.kind] || {};
const CTRL = [
  { grp: 'Поверхность', k: 'kind', l: 'Тип', t: 'seg', gens: SRF, opts: KINDS, rebuild: true },
  { grp: 'Поверхность', k: 'A', l: g => kui(g).A, min: -2, max: 2, step: 0.01, f: x2, gens: SRF, show: g => !!kui(g).A },
  { grp: 'Поверхность', k: 'B', l: g => kui(g).B, min: -2, max: 2, step: 0.01, f: x2, gens: SRF, show: g => !!kui(g).B },
  { grp: 'Поверхность', k: 'C', l: g => kui(g).C, min: -1, max: 2, step: 0.01, f: x2, gens: SRF, show: g => !!kui(g).C },
  { grp: 'Поверхность', k: 'f', l: g => kui(g).f, min: 0.2, max: 6, step: 0.05, f: x2, gens: SRF, show: g => !!kui(g).f },
  { grp: 'Поверхность', k: 'wform', l: 'Форма направляющей', t: 'seg', gens: SRF, show: g => !!kui(g).wform, opts: [['sine', 'Синус'], ['bump', 'Горб'], ['zig', 'Излом'], ['step', 'Ступень']] },
  { grp: 'Поверхность', k: 'family', l: 'Полосы идут', t: 'seg', gens: SRF, opts: [['u', 'По образующим'], ['v', 'Поперёк']] },

  { grp: 'Ракурс', k: 'yaw', l: 'Поворот', min: -180, max: 180, step: 1, f: deg, gens: SRF },
  { grp: 'Ракурс', k: 'pitch', l: 'Наклон', min: -89, max: 89, step: 1, f: deg, gens: SRF },
  { grp: 'Ракурс', k: 'roll', l: 'Крен', min: -90, max: 90, step: 1, f: deg, gens: SRF },
  { grp: 'Ракурс', k: 'persp', l: 'Перспектива', min: 0, max: 1, step: 0.01, f: pct, gens: SRF },
  { grp: 'Ракурс', k: 'zoom', l: 'Масштаб', min: 0.3, max: 2.6, step: 0.01, f: pct, gens: SRF },
  { grp: 'Ракурс', k: 'fit', l: 'Растянуть по полю', min: 0, max: 1, step: 0.01, f: pct, gens: SRF },

  { grp: 'Линии', k: 'n', l: 'Количество', min: 4, max: 140, step: 1, f: v => String(v), gens: ALL },
  { grp: 'Линии', k: 'fMin', l: 'Самые тонкие, доля шага', min: 0.02, max: 0.95, step: 0.01, f: pct, gens: ALL, show: g => g.ramp !== 'flat' },
  { grp: 'Линии', k: 'fMax', l: 'Самые толстые, доля шага', min: 0.02, max: 0.98, step: 0.01, f: pct, gens: ALL },
  { grp: 'Линии', k: 'ramp', l: 'Разгон толщины', t: 'seg', gens: ALL,
    opts: [['up', 'Нарастает'], ['down', 'Спадает'], ['peak', 'К центру'], ['vee', 'К краям'], ['wave', 'Волной'], ['code', 'Штрихкод'], ['flat', 'Ровно']] },
  { grp: 'Линии', k: 'teeth', l: 'Повторов разгона', min: 1, max: 6, step: 1, f: v => String(v), gens: ALL, show: g => !['flat', 'code'].includes(g.ramp) },
  { grp: 'Линии', k: 'gamma', l: 'Ускорение', min: 0.4, max: 3, step: 0.05, f: x2, gens: ALL, show: g => g.ramp !== 'flat' },
  { grp: 'Линии', k: 'soft', l: 'Мягкий откат на стыке', min: 0, max: 0.5, step: 0.01, f: pct, gens: ALL, show: g => g.ramp === 'up' || g.ramp === 'down' },
  { grp: 'Линии', k: 'taper', l: 'Сужение вдоль линии', min: -1, max: 1, step: 0.01, f: v => (v === 0 ? 'нет' : (v > 0 ? 'к началу ' : 'к концу ') + Math.round(Math.abs(v) * 100) + ' %'), gens: ALL },
  { grp: 'Линии', k: 'hair', l: 'Самая тонкая линия на ребре', min: 0, max: 4, step: 0.1, f: x2, gens: SRF },

  { grp: 'Форма', k: 'angle', l: 'Наклон полос', min: -90, max: 90, step: 1, f: deg, gens: LIN },
  { grp: 'Форма', k: 'duo', l: 'Продолжить линии вторым цветом', t: 'check', gens: LIN, show: g => (g.bands | 0) <= 1 && g.anchor !== 'mid' },
  { grp: 'Форма', k: 'gap', l: 'Зазор между цветами', min: 0, max: 0.2, step: 0.005, f: pct, gens: LIN, show: g => g.duo && (g.bands | 0) <= 1 && g.anchor !== 'mid' },
  { grp: 'Форма', k: 'bands', l: 'Ярусы со сдвигом', min: 1, max: 5, step: 1, f: v => String(v), gens: LIN },
  { grp: 'Форма', k: 'bandOv', l: 'Перекрытие ярусов', min: 0, max: 0.4, step: 0.01, f: pct, gens: LIN, show: g => g.bands > 1 },
  { grp: 'Форма', k: 'bandShift', l: 'Сдвиг ярусов, доля шага', min: 0, max: 1, step: 0.01, f: pct, gens: LIN, show: g => g.bands > 1 },
  { grp: 'Форма', k: 'bandFlip', l: 'Зеркалить разгон в соседнем ярусе', t: 'check', gens: LIN, show: g => g.bands > 1 },
  { grp: 'Форма', k: 'dash', l: 'Пунктир: линии рвутся на пакеты', t: 'check', gens: LIN },
  { grp: 'Форма', k: 'dLen', l: 'Длина пакета', min: 0.01, max: 0.4, step: 0.005, f: pct, gens: LIN, show: g => g.dash },
  { grp: 'Форма', k: 'dGap', l: 'Промежутки', min: 0.1, max: 3, step: 0.05, f: x2, gens: LIN, show: g => g.dash },
  { grp: 'Форма', k: 'dVar', l: 'Разброс скоростей', min: 0, max: 3, step: 1, f: v => String(v), gens: LIN, show: g => g.dash },
  { grp: 'Форма', k: 'dAlt', l: 'Соседние линии бегут навстречу', t: 'check', gens: LIN, show: g => g.dash },

  { grp: 'Длина линий', k: 'anchor', l: 'Линии растут', t: 'seg', gens: ALL, show: g => (g.bands | 0) <= 1, opts: [['start', 'От начала'], ['mid', 'От середины'], ['end', 'От конца']] },
  { grp: 'Длина линий', k: 'prof', l: 'Профиль', t: 'seg', gens: ALL, show: g => (g.bands | 0) <= 1,
    opts: [['full', 'Целиком'], ['stair', 'Лесенка'], ['peak', 'Пик'], ['valley', 'Ложбина'], ['growth', 'Рост'], ['random', 'Вразброс']] },
  { grp: 'Длина линий', k: 'pLo', l: 'Самые короткие', min: 0, max: 1, step: 0.01, f: pct, gens: ALL, show: g => g.prof !== 'full' && (g.bands | 0) <= 1 },
  { grp: 'Длина линий', k: 'pHi', l: 'Самые длинные', min: 0, max: 1, step: 0.01, f: pct, gens: ALL, show: g => (g.bands | 0) <= 1 && (g.prof !== 'full' || g.wob !== 'none') },
  { grp: 'Длина линий', k: 'pCurve', l: 'Изгиб лесенки', min: 0.3, max: 3, step: 0.05, f: x2, gens: ALL, show: g => g.prof === 'stair' && (g.bands | 0) <= 1 },
  { grp: 'Длина линий', k: 'pDrift', l: 'Перекат кривой роста', min: 0, max: 0.4, step: 0.01, f: pct, gens: ALL, show: g => g.prof === 'growth' && (g.bands | 0) <= 1 },
  { grp: 'Длина линий', k: 'wob', l: 'Колебание длины', t: 'seg', gens: ALL, show: g => (g.bands | 0) <= 1, opts: [['none', 'Нет'], ['wave', 'Волна'], ['eq', 'Эквалайзер']] },
  { grp: 'Длина линий', k: 'pAmp', l: 'Размах колебания', min: 0, max: 0.6, step: 0.005, f: pct, gens: ALL, show: g => g.wob !== 'none' && (g.bands | 0) <= 1 },
  { grp: 'Длина линий', k: 'pFreq', l: 'Частота колебания', min: 0.2, max: 6, step: 0.05, f: x2, gens: ALL, show: g => g.wob !== 'none' && (g.bands | 0) <= 1 },

  { grp: 'Объём и наложение', k: 'shade', l: 'Свет и тень', min: 0, max: 1, step: 0.01, f: v => (v ? pct(v) : 'нет'), gens: SRF },
  { grp: 'Объём и наложение', k: 'fog', l: 'Дальние полосы тают в фоне', min: 0, max: 1, step: 0.01, f: v => (v ? pct(v) : 'нет'), gens: SRF },
  { grp: 'Объём и наложение', k: 'glass', l: 'Прозрачность полос', min: 0, max: 0.8, step: 0.01, f: v => (v ? pct(v) : 'нет'), gens: ALL },
  { grp: 'Объём и наложение', k: 'zsort', l: 'Ближние полосы закрывают дальние', t: 'check', gens: SRF },
  { grp: 'Объём и наложение', k: 'res', l: 'Плавность изгибов', min: 16, max: 160, step: 1, f: v => String(v), gens: SRF },
  { grp: 'Объём и наложение', k: 'l2', l: 'Второй слой полос поверх первого', t: 'check', gens: ALL },
  { grp: 'Объём и наложение', k: 'l2Mirror', l: 'Второй слой зеркально', t: 'check', gens: ALL, show: g => g.l2 },
  { grp: 'Объём и наложение', k: 'l2Shift', l: 'Сдвиг второго слоя, доля шага', min: 0, max: 1, step: 0.01, f: pct, gens: LIN, show: g => g.l2 },
  { grp: 'Объём и наложение', k: 'l2Yaw', l: 'Поворот второго слоя', min: -180, max: 180, step: 1, f: deg, gens: SRF, show: g => g.l2 },
  { grp: 'Объём и наложение', k: 'l2Phase', l: 'Сдвиг волны второго слоя', min: 0, max: 1, step: 0.01, f: x2, gens: SRF, show: g => g.l2 },

  { grp: 'Движение', k: 'k', l: 'Бежит волна поверхности', min: -4, max: 4, step: 1, f: times, gens: SRF },
  { grp: 'Движение', k: 'flow', l: 'Полосы скользят поперёк', min: -4, max: 4, step: 1, f: times, gens: ALL, show: g => !g.dash },
  { grp: 'Движение', k: 'sway', l: 'Покачивание поворота', min: 0, max: 60, step: 1, f: deg, gens: SRF },
  { grp: 'Движение', k: 'swayP', l: 'Покачивание наклона', min: 0, max: 40, step: 1, f: deg, gens: SRF },
  { grp: 'Движение', k: 'spin', l: 'Полных оборотов ракурса', min: -2, max: 2, step: 1, f: times, gens: SRF },
  { grp: 'Движение', k: 'rampSpeed', l: 'Бежит волна толщины', min: -4, max: 4, step: 1, f: times, gens: ALL },
  { grp: 'Движение', k: 'pSpeed', l: 'Бежит колебание длины', min: -4, max: 4, step: 1, f: times, gens: ALL, show: g => g.wob !== 'none' && (g.bands | 0) <= 1 },
  { grp: 'Движение', k: 'dSpeed', l: 'Бегут пакеты', min: -4, max: 4, step: 1, f: times, gens: LIN, show: g => g.dash },
];
const FOCUS_GENS = { surface: 1 };
const MASKS = [['none', 'Нет'], ['square', 'Квадрат'], ['diamond', 'Ромб'], ['tri', 'Треугольник'], ['slant', 'Скос'], ['band', 'Диагональ']];

/* ───────────────────────── 2. state ───────────────────────── */
const presetById = id => PRESETS.find(p => p.id === id) || PRESETS[0];
const presetG = id => Object.assign({}, BASE, presetById(id).g);
const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
const themeCols = id => { const t = themeById(id); return { bg: t.bg, ink: t.ink, card: t.card, p: t.p.slice() }; };
const DEFAULTS = () => ({
  v: 2,
  fmt: 'slide', layout: 'right', fsize: 0.48,
  preset: 'konoid', g: presetG('konoid'), color: 'solid',
  fade: { dir: 'none', len: 0.6 }, mask: { shape: 'none', size: 0.8, x: 0.5, y: 0.5 }, glow: 0,
  theme: 'violet', cols: themeCols('violet'),
  text: {
    mode: 'sub', title: 'От первого чека\nдо повторной покупки', sub: 'Технологии лояльности и клиентского опыта',
    eyebrow: true, eyebrowText: 'PremiumBonus', web: false, webLabel: 'Вебинар', webDate: '23 октября', webTime: '11:00 МСК', webStyle: 'bar',
    scale: 1, weight: 'regular', pos: 'top',
  },
  logo: { corner: 'tr', size: 0.2, x: null, y: null },
  photo: { mode: 'under', shape: 'rect', tone: 'none', x: 0.74, y: 0.58, s: 0.78 },
  loop: 8, tab: 'move',
  pngScale: 1, vidFmt: 'mp4', vidFps: 30, vidQ: 'high', gifSize: 'half', gifFps: 20,
});
let S = DEFAULTS();
const LS = 'polosator.v2';
function save() {
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* storage off */ }
}
function loadSaved() {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return;
    const o = JSON.parse(raw), d = DEFAULTS();
    if (!o || o.v !== 2) return;
    S = Object.assign(d, o, {
      g: Object.assign({}, BASE, o.g), text: Object.assign(d.text, o.text), logo: Object.assign(d.logo, o.logo), photo: Object.assign(d.photo, o.photo),
      fade: Object.assign(d.fade, o.fade), mask: Object.assign(d.mask, o.mask), cols: Object.assign(d.cols, o.cols),
    });
    if (!FORMATS.some(f => f.id === S.fmt)) S.fmt = 'slide';
    if (!PRESETS.some(p => p.id === S.preset)) { S.preset = 'razgon'; S.g = presetG('razgon'); }
    if (S.text.eyebrowText === 'Premium Bonus' || S.text.eyebrowText === 'PREMIUM BONUS') S.text.eyebrowText = 'PremiumBonus';
  } catch (e) { /* ignore a broken save */ }
}
const fmt = () => FORMATS.find(f => f.id === S.fmt) || FORMATS[0];
const gen = () => presetById(S.preset).gen;

/* ───────────────────────── 3. fonts and text ───────────────────────── */
const fonts = {};
function b64ToBuf(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
const CAP = 0.7; /* cap height of F37 Holborn, in em */
/* glue short words to the next one so lines never end on «до», «и», «в» */
const glue = s => s.replace(/(?<=^|[\s(«])([А-Яа-яЁёA-Za-z]{1,2}) /g, '$1\u00A0').replace(/ ([—–]) /g, '\u00A0$1 ');
function measure(font, str, size, ls) { return font.getAdvanceWidth(str, size, { kerning: true, letterSpacing: ls }) - (str.length ? ls * size : 0); }
function wrap(font, text, size, maxW, ls) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = glue(para.trim()).split(/ +/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = cur + ' ' + words[i];
      if (measure(font, next.replace(/ /g, ' '), size, ls) <= maxW) cur = next; else { lines.push(cur); cur = words[i]; }
    }
    lines.push(cur);
  }
  return lines.map(l => l.replace(/ /g, ' '));
}
function linePath(font, str, x, y, size, ls) {
  return font.getPath(str, x, y, size, { kerning: true, letterSpacing: ls }).toPathData(2);
}
const pathCache = new Map();
function cachedPath2D(d) {
  let p = pathCache.get(d);
  if (!p) { p = new Path2D(d); if (pathCache.size > 400) pathCache.clear(); pathCache.set(d, p); }
  return p;
}

/* text block → list of shapes {d, fill} + rects; all in format units */
let textMemo = { key: '', val: null };
function textBlock(W, H, T, C, acc) {
  const tx = S.text;
  const key = JSON.stringify([W, H, T, tx, C.ink, acc]);
  if (textMemo.key === key) return textMemo.val;
  const U = Math.min(W, H), out = { shapes: [], rects: [], caps: [] };
  if (tx.mode === 'none') { textMemo = { key, val: out }; return out; }
  const fT = fonts[tx.weight] || fonts.regular, fR = fonts.regular, fM = fonts.medium;
  const lsT = -0.012, lh = 1.04;
  /* eyebrow */
  let eyeH = 0;
  const es = Math.max(14, U * 0.021);
  const eyeOn = tx.eyebrow && tx.eyebrowText.trim();
  if (eyeOn) eyeH = es * 1.25;
  /* group sizes, shrunk until they fit */
  const webOn = tx.web && (tx.webDate.trim() || tx.webTime.trim() || tx.webLabel.trim());
  const subOn = tx.mode === 'sub' && tx.sub.trim();
  const base = H > W * 1.1 ? 0.088 : 0.074;
  let ts = U * base * tx.scale, tries = 0, G;
  const availH = T.h - (eyeOn ? eyeH + U * 0.05 : 0);
  for (;;) {
    G = groupLayout(ts);
    if ((G.w <= T.w + 0.5 && G.h <= availH + 0.5) || tries++ > 24) break;
    ts *= 0.94;
  }
  function groupLayout(ts) {
    const ss = Math.max(U * 0.024, ts * 0.38), ws = Math.max(U * 0.026, ts * 0.36);
    const title = tx.title.trim() ? wrap(fT, tx.title, ts, T.w, lsT) : [];
    const sub = subOn ? wrap(fR, tx.sub, ss, Math.min(T.w, Math.max(ts * 11, T.w * 0.8)), 0) : [];
    let w = 0, h = 0;
    for (const l of title) w = Math.max(w, measure(fT, l, ts, lsT));
    for (const l of sub) w = Math.max(w, measure(fR, l, ss, 0));
    if (title.length) h += CAP * ts + (title.length - 1) * ts * lh + ts * 0.2;
    if (sub.length) h += (h ? ts * 0.42 : 0) + CAP * ss + (sub.length - 1) * ss * 1.28 + ss * 0.25;
    const web = webOn ? webLayout(ts, ws) : null;
    if (web) { h += (h ? ts * 0.62 : 0) + web.h; w = Math.max(w, web.w); }
    return { ts, ss, ws, title, sub, web, w, h };
  }
  function webLayout(ts, ws) {
    const lab = tx.webLabel.trim(), dt = [tx.webDate.trim(), tx.webTime.trim()].filter(Boolean).join(' · ');
    if (tx.webStyle === 'pill') {
      const line = [lab, dt].filter(Boolean).join('  ·  '), ps = ws * 0.92;
      const tw = measure(fM, line, ps, 0.01), padX = ps * 0.95, hh = ps * 2.3;
      return { kind: 'pill', line, ps, w: tw + padX * 2, h: hh, padX };
    }
    if (tx.webStyle === 'big') {
      const bs = Math.max(ws * 1.9, ts * 0.72), ls2 = Math.max(U * 0.026, ws * 0.78);
      const w1 = dt ? measure(fR, dt, bs, -0.01) : 0, w2 = lab ? measure(fR, lab, ls2, 0.02) : 0;
      return { kind: 'big', dt, lab, bs, ls2, w: Math.max(w1, w2), h: (dt ? CAP * bs : 0) + (lab ? (dt ? bs * 0.42 : 0) + CAP * ls2 : 0) + ls2 * 0.3 };
    }
    const ls2 = Math.max(U * 0.019, ws * 0.62), bw = Math.max(2, U * 0.003), gap = ws * 0.62;
    const w1 = dt ? measure(fM, dt, ws, 0) : 0, w2 = lab ? measure(fR, lab, ls2, 0.02) : 0;
    const h = (lab ? CAP * ls2 + ls2 * 0.9 : 0) + (dt ? CAP * ws : 0);
    return { kind: 'bar', dt, lab, ls2, bw, gap, w: bw + gap + Math.max(w1, w2), h: h + ws * 0.25 };
  }
  /* place */
  const x = T.x;
  if (eyeOn) {
    const bw = Math.max(2, U * 0.0028);
    out.rects.push({ x, y: T.y, w: bw, h: es * 1.15, fill: acc });
    out.shapes.push({ d: linePath(fM, tx.eyebrowText.trim(), x + bw + es * 0.75, T.y + es * 0.575 + (CAP * es) / 2, es * 1.12, 0.01), fill: C.ink });
  }
  let y = tx.pos === 'bottom' ? T.y + T.h - G.h : T.y + (eyeOn ? eyeH + U * 0.05 : 0);
  const ts2 = G.ts;
  if (G.title.length) {
    const d = G.title.map((l, i) => linePath(fT, l, x, y + CAP * ts2 + i * ts2 * lh, ts2, lsT)).join('');
    out.shapes.push({ d, fill: C.ink });
    y += CAP * ts2 + (G.title.length - 1) * ts2 * lh + ts2 * 0.2;
  }
  if (G.sub.length) {
    if (G.title.length) y += ts2 * 0.42;
    const d = G.sub.map((l, i) => linePath(fR, l, x, y + CAP * G.ss + i * G.ss * 1.28, G.ss, 0)).join('');
    out.shapes.push({ d, fill: C.ink });
    y += CAP * G.ss + (G.sub.length - 1) * G.ss * 1.28 + G.ss * 0.25;
  }
  if (G.web) {
    const w = G.web;
    if (G.title.length || G.sub.length) y += ts2 * 0.62;
    if (w.kind === 'pill') {
      out.rects.push({ x, y, w: w.w, h: w.h, r: w.h / 2, fill: acc });
      const ink = luminance(acc) > 0.45 ? '#16121F' : '#FFFFFF';
      out.shapes.push({ d: linePath(fM, w.line, x + w.padX, y + w.h / 2 + (CAP * w.ps) / 2, w.ps, 0.01), fill: ink });
    } else if (w.kind === 'big') {
      let yy = y;
      if (w.dt) { out.shapes.push({ d: linePath(fR, w.dt, x, yy + CAP * w.bs, w.bs, -0.01), fill: C.ink }); yy += CAP * w.bs + w.bs * 0.42; }
      if (w.lab) out.shapes.push({ d: linePath(fR, w.lab, x, yy + CAP * w.ls2, w.ls2, 0.02), fill: C.ink });
    } else {
      out.rects.push({ x, y, w: w.bw, h: w.h, fill: acc });
      let yy = y, xx = x + w.bw + w.gap;
      if (w.lab) { out.shapes.push({ d: linePath(fR, w.lab, xx, yy + CAP * w.ls2, w.ls2, 0.02), fill: C.ink }); yy += CAP * w.ls2 + w.ls2 * 0.9; }
      if (w.dt) out.shapes.push({ d: linePath(fM, w.dt, xx, yy + CAP * G.ws, G.ws, 0), fill: C.ink });
    }
  }
  out.fit = G.ts / (U * base * tx.scale);
  textMemo = { key, val: out };
  return out;
}

/* ───────────────────────── 4. scene ───────────────────────── */
function layoutOf(W, H, kind, s) {
  const U = Math.min(W, H), m = Math.round(U * 0.075), land = W >= H * 1.05;
  let F, T, r = 0, pos = 'top';
  switch (kind) {
    case 'left': F = { x: 0, y: 0, w: W * s, h: H }; T = { x: W * s + m * 0.8, y: m, w: W * (1 - s) - m * 1.8, h: H - 2 * m }; break;
    case 'bottom': F = { x: 0, y: H * (1 - s), w: W, h: H * s }; T = { x: m, y: m, w: W - 2 * m, h: H * (1 - s) - m * 1.7 }; break;
    case 'top': F = { x: 0, y: 0, w: W, h: H * s }; T = { x: m, y: H * s + m * 0.8, w: W - 2 * m, h: H * (1 - s) - m * 1.8 }; pos = 'bottom'; break;
    case 'full': F = { x: 0, y: 0, w: W, h: H }; T = { x: m, y: m, w: land ? W * 0.52 : W - 2 * m, h: H - 2 * m }; break;
    case 'card': {
      const g = Math.round(U * 0.032); r = 0;
      if (land) { F = { x: W * (1 - s) + g * 0.5, y: g, w: W * s - g * 1.5, h: H - 2 * g }; T = { x: m, y: m, w: W * (1 - s) - m * 1.6, h: H - 2 * m }; }
      else { F = { x: g, y: g, w: W - 2 * g, h: H * s - g * 1.5 }; T = { x: m, y: H * s + m * 0.6, w: W - 2 * m, h: H * (1 - s) - m * 1.6 }; pos = 'bottom'; }
      break;
    }
    default: F = { x: W * (1 - s), y: 0, w: W * s, h: H }; T = { x: m, y: m, w: W * (1 - s) - m * 1.8, h: H - 2 * m };
  }
  if (T.w < U * 0.2) T.w = U * 0.2;
  if (T.h < U * 0.12) T.h = U * 0.12;
  return { F, T, r, pos, U, m };
}
function colorsNow() {
  const C = S.cols, p = C.p.filter(Boolean);
  const ground = S.layout === 'card' ? C.card : C.bg;
  /* accent for bars and the webinar pill: first stripe colour that stands out on the page */
  const cr = (a, b) => { const A = luminance(a) + 0.05, B = luminance(b) + 0.05; return A > B ? A / B : B / A; };
  let acc = p.find(c => cr(c, C.bg) > 1.55) || C.ink;
  return { bg: C.bg, ink: C.ink, card: C.card, p, ground, acc, dark: mixHex(ground, '#0B0618', 0.55) };
}
let lutMemo = { k: '', v: null };
function lutFor(p) { const k = p.join(); if (lutMemo.k !== k) lutMemo = { k, v: rampLut(p) }; return lutMemo.v; }

/* photo and logo live as images in memory; their frames are computed in format units */
let photo = null, logo = null;
function photoRect(W, H) {
  if (!photo) return null;
  const h = S.photo.s * H, ar = photo.w / photo.h;
  const w = h * ar;
  return { x: S.photo.x * W - w / 2, y: S.photo.y * H - h / 2, w, h };
}
function photoShapePath(R, U) {
  const sh = S.photo.shape, k = Math.min(R.w, R.h);
  if (sh === 'slant') { const d = k * 0.22; return [['poly', [[R.x + d, R.y], [R.x + R.w, R.y], [R.x + R.w - d, R.y + R.h], [R.x, R.y + R.h]]]]; }
  if (sh === 'cut') { const d = k * 0.18; return [['poly', [[R.x, R.y], [R.x + R.w - d, R.y], [R.x + R.w, R.y + d], [R.x + R.w, R.y + R.h], [R.x + d, R.y + R.h], [R.x, R.y + R.h - d]]]]; }
  return [['poly', [[R.x, R.y], [R.x + R.w, R.y], [R.x + R.w, R.y + R.h], [R.x, R.y + R.h]]]];
}
function logoRect(W, H, m) {
  if (!logo) return null;
  const U = Math.min(W, H), w = S.logo.size * U, h = (w * logo.h) / logo.w;
  if (S.logo.x != null) return { x: S.logo.x * W - w / 2, y: S.logo.y * H - h / 2, w, h };
  const c = S.logo.corner, x = c[1] === 'l' ? m : W - m - w, y = c[0] === 't' ? m : H - m - h;
  return { x, y, w, h };
}
function scene(t) {
  const f = fmt(), W = f.w, H = f.h;
  const L = layoutOf(W, H, S.layout, S.fsize);
  const C = colorsNow();
  const g = S.g, F = L.F, U = L.U;
  const strips = buildStrips(gen(), g, t, F, U);
  colorize(strips, S.color === 'sweep' ? 'solid' : S.color, lutFor(C.p), C.p, { shade: g.shade, fog: g.fog, dark: C.dark, bg: C.ground });
  const mask = maskPath(S.mask, F);
  const tb = textBlock(W, H, L.T, C, C.acc);
  return { W, H, L, C, F, U, strips, mask, tb, pr: photoRect(W, H), lr: logoRect(W, H, L.m) };
}
function sweepAxis(sc) {
  const F = sc.F, g = S.g;
  const th = ((gen() === 'surface' ? 0 : g.angle || 0) * Math.PI) / 180;
  const ax = Math.sin(th), ay = -Math.cos(th), cx = F.x + F.w / 2, cy = F.y + F.h / 2;
  const half = (Math.abs(ax) * F.w) / 2 + (Math.abs(ay) * F.h) / 2;
  return { radial: false, x0: cx - ax * half, y0: cy - ay * half, x1: cx + ax * half, y1: cy + ay * half };
}
function fadeAxis(sc) {
  const F = sc.F, d = S.fade.dir;
  if (d === 'out') {
    const g = S.g, focus = FOCUS_GENS[gen()];
    const cx = focus ? F.x + g.fx * F.w : F.x + F.w / 2, cy = focus ? F.y + g.fy * F.h : F.y + F.h / 2;
    let far = 0; for (const [x, y] of [[F.x, F.y], [F.x + F.w, F.y], [F.x, F.y + F.h], [F.x + F.w, F.y + F.h]]) far = Math.max(far, Math.hypot(x - cx, y - cy));
    return { radial: true, cx, cy, r: far };
  }
  const v = { up: [0, 1, 0, 0], down: [0, 0, 0, 1], left: [1, 0, 0, 0], right: [0, 0, 1, 0] }[d];
  if (!v) return null;
  /* gradient runs from the solid side (offset 0) to the side that fades away (offset 1) */
  const P = (fx, fy) => [F.x + fx * F.w, F.y + fy * F.h];
  const a = d === 'up' ? P(0, 1) : d === 'down' ? P(0, 0) : d === 'left' ? P(1, 0) : P(0, 0);
  const b = d === 'up' ? P(0, 0) : d === 'down' ? P(0, 1) : d === 'left' ? P(0, 0) : P(1, 0);
  return { radial: false, x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
}
function fadeStops() {
  const L = clamp(S.fade.len, 0.05, 1), s0 = 1 - L, out = [];
  for (let i = 0; i <= 8; i++) { const o = s0 + (L * i) / 8; out.push([o, 1 - smooth(i / 8)]); }
  out.unshift([0, 1]);
  return out;
}

/* ───────────────────────── 5a. canvas renderer ───────────────────────── */
const layers = { L: null, P: null };
function layer(name, w, h) {
  let c = layers[name];
  if (!c) { c = document.createElement('canvas'); layers[name] = c; }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
let filterOK = null;
function canFilter() {
  if (filterOK == null) { try { const c = document.createElement('canvas').getContext('2d'); filterOK = typeof c.filter === 'string'; c.filter = 'blur(2px)'; filterOK = filterOK && c.filter === 'blur(2px)'; } catch (e) { filterOK = false; } }
  return filterOK;
}
function shapeToCanvas(ctx, path) { maskToCanvas(ctx, path); }
function drawPhoto(ctx, sc, scale, src) {
  const R = sc.pr; if (!R) return;
  const img = src || photoSource();
  ctx.save();
  shapeToCanvas(ctx, photoShapePath(R, sc.U)); ctx.clip();
  const ar = img.width / img.height, rar = R.w / R.h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ar > rar) { sw = img.height * rar; sx = (img.width - sw) / 2; } else { sh = img.width / rar; sy = (img.height - sh) / 2; }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, R.x, R.y, R.w, R.h);
  ctx.restore();
}
function renderTo(canvas, scale, t) {
  const sc = scene(t), { W, H, C, F, L } = sc;
  const ctx = canvas.getContext('2d');
  const pw = canvas.width, ph = canvas.height;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  if (S.layout === 'card') { ctx.fillStyle = C.card; ctx.beginPath(); roundRectPath(ctx, F.x, F.y, F.w, F.h, L.r); ctx.fill(); }
  const mode = S.photo.mode;
  if (photo && mode === 'under') drawPhoto(ctx, sc, scale);
  /* stripes layer */
  const Lc = layer('L', pw, ph), lx = Lc.getContext('2d');
  lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.clearRect(0, 0, pw, ph);
  lx.setTransform(scale, 0, 0, scale, 0, 0);
  lx.save();
  lx.beginPath(); roundRectPath(lx, F.x, F.y, F.w, F.h, L.r); lx.clip();
  if (sc.mask) { maskToCanvas(lx, sc.mask); lx.clip(); }
  let sweep = null;
  if (S.color === 'sweep') {
    const a = sweepAxis(sc);
    sweep = a.radial ? lx.createRadialGradient(a.cx, a.cy, 0, a.cx, a.cy, a.r) : lx.createLinearGradient(a.x0, a.y0, a.x1, a.y1);
    C.p.forEach((c, i) => sweep.addColorStop(C.p.length > 1 ? i / (C.p.length - 1) : 0, c));
  }
  let lastCol = null;
  lx.globalAlpha = 1 - (S.g.glass || 0);
  for (const s of sc.strips) {
    const col = sweep || s.col;
    if (col !== lastCol) { lx.fillStyle = col; lastCol = col; }
    lx.beginPath(); pathStrip(lx, s); lx.fill();
  }
  lx.globalAlpha = 1;
  lx.restore();
  const fa = fadeAxis(sc);
  if (fa) {
    lx.save(); lx.globalCompositeOperation = 'destination-in';
    const gr = fa.radial ? lx.createRadialGradient(fa.cx, fa.cy, 0, fa.cx, fa.cy, fa.r) : lx.createLinearGradient(fa.x0, fa.y0, fa.x1, fa.y1);
    for (const [o, a] of fadeStops()) gr.addColorStop(clamp(o, 0, 1), `rgba(0,0,0,${a.toFixed(3)})`);
    lx.fillStyle = gr; lx.fillRect(F.x - 2, F.y - 2, F.w + 4, F.h + 4);
    lx.restore();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.glow > 0 && canFilter()) {
    ctx.save();
    ctx.filter = `blur(${Math.max(1, S.glow * sc.U * 0.03 * scale).toFixed(1)}px)`;
    ctx.globalAlpha = Math.min(1, 0.55 + S.glow * 0.4);
    ctx.drawImage(Lc, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(Lc, 0, 0);
  if (photo && mode === 'mask') {
    const Pc = layer('P', pw, ph), px = Pc.getContext('2d');
    px.setTransform(1, 0, 0, 1, 0, 0); px.globalCompositeOperation = 'source-over'; px.clearRect(0, 0, pw, ph);
    px.setTransform(scale, 0, 0, scale, 0, 0);
    drawPhoto(px, sc, scale);
    px.setTransform(1, 0, 0, 1, 0, 0); px.globalCompositeOperation = 'destination-in'; px.drawImage(Lc, 0, 0);
    ctx.drawImage(Pc, 0, 0);
  }
  ctx.restore();
  if (photo && mode === 'over') drawPhoto(ctx, sc, scale);
  /* text */
  for (const r of sc.tb.rects) { ctx.fillStyle = r.fill; ctx.beginPath(); roundRectPath(ctx, r.x, r.y, r.w, r.h, r.r || 0); ctx.fill(); }
  for (const s of sc.tb.shapes) { ctx.fillStyle = s.fill; ctx.fill(cachedPath2D(s.d)); }
  if (logo && sc.lr) ctx.drawImage(logo.img, sc.lr.x, sc.lr.y, sc.lr.w, sc.lr.h);
  return sc;
}

/* photo tone: grey or two-colour, computed once per photo and palette */
let toneMemo = { key: '', canvas: null };
function photoSource() {
  if (!photo) return null;
  if (S.photo.tone === 'none') return photo.img;
  const C = S.cols;
  const dark = S.photo.tone === 'duo' ? mixHex(C.bg, '#0B0618', 0.62) : '#000000';
  const light = S.photo.tone === 'duo' ? mixHex('#FFFFFF', C.p[0] || '#FFFFFF', 0.28) : '#FFFFFF';
  const key = photo.id + S.photo.tone + dark + light;
  if (toneMemo.key === key) return toneMemo.canvas;
  const c = document.createElement('canvas'); c.width = photo.img.width; c.height = photo.img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(photo.img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  const D = hexToRgb(dark), Lc = hexToRgb(light);
  for (let i = 0; i < d.length; i += 4) {
    let y = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    y = smooth(clamp((y - 0.04) / 0.92, 0, 1)) * 0.85 + y * 0.15;
    d[i] = D[0] + (Lc[0] - D[0]) * y; d[i + 1] = D[1] + (Lc[1] - D[1]) * y; d[i + 2] = D[2] + (Lc[2] - D[2]) * y;
  }
  x.putImageData(id, 0, 0);
  toneMemo = { key, canvas: c };
  return c;
}
function imgDataUrl(img, hasAlpha) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return hasAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
}

/* ───────────────────────── 5b. SVG writer ───────────────────────── */
function svgString(t) {
  const sc = scene(t), { W, H, C, F, L, U } = sc;
  const f2 = v => +(+v).toFixed(2);
  const dp = 2;
  const defs = [], body = [];
  body.push(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);
  if (S.layout === 'card') body.push(`<path d="${roundRectD(F.x, F.y, F.w, F.h, L.r)}" fill="${C.card}"/>`);
  let photoEl = '';
  if (photo && sc.pr) {
    const R = sc.pr, src = photoSource(), ar = src.width / src.height, rar = R.w / R.h;
    let iw = R.w, ih = R.h, ix = R.x, iy = R.y;
    if (ar > rar) { iw = R.h * ar; ix = R.x - (iw - R.w) / 2; } else { ih = R.w / ar; iy = R.y - (ih - R.h) / 2; }
    defs.push(`<clipPath id="photoClip"><path d="${maskToSvgD(photoShapePath(R, U))}"/></clipPath>`);
    const href = S.photo.tone === 'none' ? photo.src : imgDataUrl(src, photo.alpha);
    photoEl = `<image href="${href}" x="${f2(ix)}" y="${f2(iy)}" width="${f2(iw)}" height="${f2(ih)}" preserveAspectRatio="none"/>`;
  }
  if (photoEl && S.photo.mode === 'under') body.push(`<g id="photo" clip-path="url(#photoClip)">${photoEl}</g>`);
  /* stripes */
  defs.push(`<clipPath id="fieldClip"><path d="${roundRectD(F.x, F.y, F.w, F.h, L.r)}"/></clipPath>`);
  if (sc.mask) defs.push(`<clipPath id="shapeClip"><path d="${maskToSvgD(sc.mask)}"/></clipPath>`);
  let fillAll = null;
  if (S.color === 'sweep') {
    const a = sweepAxis(sc), stops = C.p.map((c, i) => `<stop offset="${C.p.length > 1 ? f2(i / (C.p.length - 1)) : 0}" stop-color="${c}"/>`).join('');
    defs.push(a.radial
      ? `<radialGradient id="sweep" gradientUnits="userSpaceOnUse" cx="${f2(a.cx)}" cy="${f2(a.cy)}" r="${f2(a.r)}">${stops}</radialGradient>`
      : `<linearGradient id="sweep" gradientUnits="userSpaceOnUse" x1="${f2(a.x0)}" y1="${f2(a.y0)}" x2="${f2(a.x1)}" y2="${f2(a.y1)}">${stops}</linearGradient>`);
    fillAll = 'url(#sweep)';
  }
  /* keep drawing order (depth sorting): consecutive strips of one colour share a group */
  let stripesInner = '', curCol = null, buf = [];
  const flush = () => { if (buf.length) stripesInner += `<g fill="${curCol}">${buf.join('')}</g>`; buf = []; };
  for (const s of sc.strips) {
    const col = fillAll || s.col;
    if (col !== curCol) { flush(); curCol = col; }
    buf.push(`<path d="${stripSvgD(s, dp)}"/>`);
  }
  flush();
  if (S.g.glass > 0) stripesInner = `<g opacity="1">${stripesInner.replace(/<g fill="/g, `<g fill-opacity="${(1 - S.g.glass).toFixed(2)}" fill="`)}</g>`;
  const fa = fadeAxis(sc);
  if (fa) {
    const st = fadeStops().map(([o, a]) => `<stop offset="${f2(clamp(o, 0, 1))}" stop-color="#fff" stop-opacity="${a.toFixed(3)}"/>`).join('');
    defs.push(fa.radial
      ? `<radialGradient id="fadeG" gradientUnits="userSpaceOnUse" cx="${f2(fa.cx)}" cy="${f2(fa.cy)}" r="${f2(fa.r)}">${st}</radialGradient>`
      : `<linearGradient id="fadeG" gradientUnits="userSpaceOnUse" x1="${f2(fa.x0)}" y1="${f2(fa.y0)}" x2="${f2(fa.x1)}" y2="${f2(fa.y1)}">${st}</linearGradient>`);
    defs.push(`<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="${f2(F.x)}" y="${f2(F.y)}" width="${f2(F.w)}" height="${f2(F.h)}" fill="url(#fadeG)"/></mask>`);
  }
  if (S.glow > 0) defs.push(`<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f2(S.glow * U * 0.03)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  let stripes = stripesInner;
  if (sc.mask) stripes = `<g clip-path="url(#shapeClip)">${stripes}</g>`;
  stripes = `<g clip-path="url(#fieldClip)">${stripes}</g>`;
  if (fa) stripes = `<g mask="url(#fade)">${stripes}</g>`;
  if (S.glow > 0) stripes = `<g filter="url(#glow)">${stripes}</g>`;
  body.push(`<g id="stripes">${stripes}</g>`);
  if (photoEl && S.photo.mode === 'mask') {
    defs.push(`<mask id="stripesMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><g fill="#fff">${stripesInner.replace(/fill="[^"]*"/g, 'fill="#fff"')}</g></mask>`);
    let inner = `<g clip-path="url(#fieldClip)">${sc.mask ? `<g clip-path="url(#shapeClip)">` : ''}<g mask="url(#stripesMask)"><g clip-path="url(#photoClip)">${photoEl}</g></g>${sc.mask ? '</g>' : ''}</g>`;
    if (fa) inner = `<g mask="url(#fade)">${inner}</g>`;
    body.push(`<g id="photo-in-stripes">${inner}</g>`);
  }
  if (photoEl && S.photo.mode === 'over') body.push(`<g id="photo" clip-path="url(#photoClip)">${photoEl}</g>`);
  const tparts = [];
  for (const r of sc.tb.rects) tparts.push(`<path d="${roundRectD(r.x, r.y, r.w, r.h, r.r || 0)}" fill="${r.fill}"/>`);
  for (const s of sc.tb.shapes) tparts.push(`<path d="${s.d}" fill="${s.fill}"/>`);
  if (tparts.length) body.push(`<g id="text">${tparts.join('')}</g>`);
  if (logo && sc.lr) body.push(`<image id="logo" href="${logo.src}" x="${f2(sc.lr.x)}" y="${f2(sc.lr.y)}" width="${f2(sc.lr.w)}" height="${f2(sc.lr.h)}"/>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

/* ───────────────────────── 6. UI ───────────────────────── */
const cv = $('#cv'), frameEl = $('#frame'), ov = $('#ov');
let tNow = 0, playing = true, busy = false, lastTs = 0;
const view = { scale: 1, dpr: 1 };

function setP(input) { const min = +input.min, max = +input.max; input.style.setProperty('--p', ((+input.value - min) / (max - min || 1)) * 100 + '%'); }
function seg(el, opts, get, set) {
  el.innerHTML = '';
  el.classList.toggle('many', opts.length > 6);
  for (const [v, label] of opts) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = String(v);
    b.addEventListener('click', () => { set(typeof v === 'number' ? Number(b.dataset.v) : b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v); paintAll(); refresh(); });
    el.appendChild(b);
  }
  el._paint = () => { const cur = String(get()); for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === cur)); };
  paints.push(el._paint);
}
const paints = [];
function slider(container, o) {
  const id = 'sl-' + o.id;
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<label for="${id}">${o.l}</label><output for="${id}"></output><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}">`;
  const inp = row.querySelector('input'), out = row.querySelector('output');
  const paint = () => { const v = o.get(); inp.value = v; out.textContent = o.f(v); setP(inp); };
  inp.addEventListener('input', () => { o.set(+inp.value); out.textContent = o.f(+inp.value); setP(inp); if (o.after) o.after(); refresh(); });
  inp.addEventListener('change', () => { save(); if (o.change) o.change(); });
  container.appendChild(row);
  paints.push(paint);
  row._paint = paint;
  return row;
}
function check(el, get, set) { el.addEventListener('change', () => { set(el.checked); paintAll(); refresh(); save(); }); paints.push(() => { el.checked = !!get(); }); }
let movePaints = [];
function paintAll() { for (const p of paints) p(); for (const p of movePaints) p(); paintMoveVisibility(); paintTextVisibility(); paintPhoto(); paintInfo(); }

/* ── preset gallery ── */
function themeThumbCols() { const C = S.cols; return { bg: C.bg, p: C.p.filter(Boolean) }; }
function drawThumb(canvas, P) {
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d'), tc = themeThumbCols();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = tc.bg; ctx.fillRect(0, 0, w, h);
  const g = Object.assign({}, BASE, P.g), F = { x: 0, y: 0, w, h }, U = Math.min(w, h);
  const strips = buildStrips(P.gen, g, 0.18, F, U);
  colorize(strips, P.color === 'sweep' ? 'solid' : P.color, lutFor(tc.p), tc.p, { shade: g.shade, fog: g.fog, dark: mixHex(tc.bg, '#0B0618', 0.55), bg: tc.bg });
  ctx.save();
  ctx.globalAlpha = 1 - (g.glass || 0);
  const mp = maskPath(P.mask, F); if (mp) { maskToCanvas(ctx, mp); ctx.clip(); }
  let sweep = null;
  if (P.color === 'sweep') { sweep = ctx.createLinearGradient(0, h, 0, 0); tc.p.forEach((c, i) => sweep.addColorStop(tc.p.length > 1 ? i / (tc.p.length - 1) : 0, c)); }
  for (const s of strips) { ctx.fillStyle = sweep || s.col; ctx.beginPath(); pathStrip(ctx, s); ctx.fill(); }
  ctx.restore();
}
function buildGallery() {
  const box = $('#presetCards'); box.innerHTML = '';
  for (const P of PRESETS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.dataset.id = P.id;
    b.innerHTML = `<canvas width="240" height="180" aria-hidden="true"></canvas><span class="cname">${P.name}</span>`;
    b.addEventListener('click', () => applyPreset(P.id));
    box.appendChild(b);
  }
  paints.push(() => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.id === S.preset)); $('#presetName').textContent = presetById(S.preset).name; });
}
let thumbKey = '';
function renderThumbs() {
  const k = JSON.stringify(S.cols);
  if (k === thumbKey) return; thumbKey = k;
  for (const b of $('#presetCards').children) drawThumb(b.querySelector('canvas'), presetById(b.dataset.id));
  renderLayoutCards();
}
function applyPreset(id) {
  const P = presetById(id);
  S.preset = id; S.g = presetG(id); S.color = P.color || 'solid';
  S.fade = Object.assign({ dir: 'none', len: 0.6 }, P.fade || {});
  S.mask = Object.assign({ shape: 'none', size: 0.8, x: 0.5, y: 0.5 }, P.mask || {});
  buildMoveControls(); paintAll(); refresh(); save();
}

/* ── move controls (built per generator) ── */
function buildMoveControls() {
  const box = $('#moveControls'); box.innerHTML = '';
  const gn = gen(), before = paints.length;
  const groups = new Map();
  const groupEl = name => {
    if (groups.has(name)) return groups.get(name);
    const gEl = document.createElement('div'); gEl.className = 'group';
    gEl.innerHTML = `<h2>${name}</h2>`;
    const rows = document.createElement('div'); rows.className = 'rows'; gEl.appendChild(rows);
    box.appendChild(gEl); groups.set(name, rows);
    return rows;
  };
  moveItems.length = 0;
  for (const c of CTRL) {
    if (!c.gens.includes(gn)) continue;
    const rows = groupEl(c.grp);
    let el;
    if (c.t === 'seg') {
      el = document.createElement('div'); el.className = 'field';
      el.innerHTML = `<span class="lbl">${lab(c)}</span><div class="seg" role="group" aria-label="${lab(c)}"></div>`;
      rows.appendChild(el);
      const sg = el.querySelector('.seg');
      seg(sg, c.opts, () => S.g[c.k], v => { S.g[c.k] = v; save(); if (c.rebuild) setTimeout(buildMoveControls, 0); });
      sg._paint();
    } else if (c.t === 'check') {
      el = document.createElement('label'); el.className = 'check';
      el.innerHTML = `<input type="checkbox" id="chk-${c.k}"> ${lab(c)}`;
      rows.appendChild(el);
      check(el.querySelector('input'), () => S.g[c.k], v => { S.g[c.k] = v; });
    } else {
      el = slider(rows, { id: c.k, l: lab(c), min: c.min, max: c.max, step: c.step, f: c.f, get: () => S.g[c.k], set: v => { S.g[c.k] = v; }, after: () => paintMoveVisibility() });
    }
    moveItems.push({ el, c });
    if (c.k === 'kind') {
      const ab = document.createElement('p'); ab.className = 'note'; ab.textContent = kui(S.g).about || '';
      rows.appendChild(ab);
    }
  }
  /* window (mask) */
  const rows = groupEl('Окно');
  const mEl = document.createElement('div'); mEl.className = 'field';
  mEl.innerHTML = '<span class="lbl">Показать полосы внутри фигуры</span><div class="seg" role="group" aria-label="Фигура-окно"></div>';
  rows.appendChild(mEl);
  const ms = mEl.querySelector('.seg');
  seg(ms, MASKS, () => S.mask.shape, v => { S.mask.shape = v; save(); });
  ms._paint();
  const mz = slider(rows, { id: 'maskSize', l: 'Размер фигуры', min: 0.2, max: 1.6, step: 0.01, f: pct, get: () => S.mask.size, set: v => { S.mask.size = v; } });
  moveItems.push({ el: mz, c: { show: () => S.mask.shape !== 'none' } });
  const note = document.createElement('p'); note.className = 'note'; note.id = 'focusNote';
  rows.appendChild(note);
  moveItems.push({ el: note, c: { show: () => !!(FOCUS_GENS[gen()] || S.mask.shape !== 'none') } });
  movePaints = paints.splice(before);
  for (const p of movePaints) p();
  paintMoveVisibility();
}
const moveItems = [];
const lab = c => (typeof c.l === 'function' ? c.l(S.g) || '' : c.l);
function paintMoveVisibility() {
  for (const { el, c } of moveItems) el.hidden = c.show ? !c.show(S.g) : false;
  const n = $('#focusNote');
  if (n) n.textContent = gen() === 'surface' ? 'Тяните макет мышью, чтобы повернуть поверхность. С Shift — сдвинуть её, а окно двигается вместе с центром поля.' : 'Фигуру-окно можно двигать мышью прямо на макете.';
}

/* ── layout cards ── */
function renderLayoutCards() {
  const box = $('#layoutCards');
  if (!box.children.length) {
    for (const Ly of LAYOUTS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'card lay'; b.dataset.id = Ly.id;
      b.innerHTML = `<canvas width="200" height="125" aria-hidden="true"></canvas><span class="cname">${Ly.name}</span>`;
      b.addEventListener('click', () => { S.layout = Ly.id; if (Ly.id === 'card' || Ly.id === 'top') S.text.pos = 'bottom'; else if (S.text.pos === 'bottom' && !['full'].includes(Ly.id)) S.text.pos = 'top'; paintAll(); refresh(); save(); });
      box.appendChild(b);
    }
    paints.push(() => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.id === S.layout)); });
  }
  const f = fmt(), C = S.cols;
  for (const b of box.children) {
    const c = b.querySelector('canvas'), ctx = c.getContext('2d');
    const ar = f.w / f.h, cw = c.width, ch = c.height;
    let w = cw - 24, h = w / ar; if (h > ch - 20) { h = ch - 20; w = h * ar; }
    const ox = (cw - w) / 2, oy = (ch - h) / 2, k = w / f.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    const Lx = layoutOf(f.w, f.h, b.dataset.id, S.fsize);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, f.w, f.h);
    if (b.dataset.id === 'card') { ctx.fillStyle = C.card; ctx.beginPath(); roundRectPath(ctx, Lx.F.x, Lx.F.y, Lx.F.w, Lx.F.h, Lx.r); ctx.fill(); }
    ctx.save(); ctx.beginPath(); roundRectPath(ctx, Lx.F.x, Lx.F.y, Lx.F.w, Lx.F.h, Lx.r); ctx.clip();
    ctx.fillStyle = C.p[0];
    const n = 14, pw = Lx.F.w / n;
    for (let i = 0; i < n; i++) { const fr = 0.12 + 0.55 * (i / (n - 1)); ctx.fillRect(Lx.F.x + i * pw + pw * (1 - fr) / 2, Lx.F.y, pw * fr, Lx.F.h); }
    ctx.restore();
    ctx.fillStyle = C.ink;
    const U = Math.min(f.w, f.h), lh = U * 0.07, top = Lx.pos === 'bottom' && b.dataset.id !== 'full' ? Lx.T.y + Lx.T.h - lh * 2.4 : Lx.T.y + U * 0.05;
    ctx.fillRect(Lx.T.x, top, Math.min(Lx.T.w, U * 0.75), lh * 0.62);
    ctx.fillRect(Lx.T.x, top + lh, Math.min(Lx.T.w, U * 0.5), lh * 0.62);
  }
}

/* ── theme cards and colours ── */
function buildThemes() {
  const box = $('#themeCards'); box.innerHTML = '';
  for (const th of THEMES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'theme'; b.dataset.id = th.id;
    b.innerHTML = `<span class="sw" aria-hidden="true"><i style="background:${th.bg}"></i><i style="background:${th.p[0]}"></i><i style="background:${th.p[1]}"></i><i style="background:${th.p[2]}"></i></span><span>${th.name}</span>`;
    b.addEventListener('click', () => { S.theme = th.id; S.cols = themeCols(th.id); paintAll(); refresh(); save(); });
    box.appendChild(b);
  }
  paints.push(() => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.id === S.theme)); });
  const chips = $('#chips'); chips.innerHTML = '';
  for (const c of SWATCHES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.style.background = c; b.title = c; b.setAttribute('aria-label', 'Цвет ' + c);
    b.addEventListener('click', e => { if (e.shiftKey) S.cols.bg = c; else S.cols.p[0] = c; S.theme = 'custom'; paintAll(); refresh(); save(); });
    chips.appendChild(b);
  }
  const bind = (id, get, set) => {
    const el = $(id);
    el.addEventListener('input', () => { set(el.value.toUpperCase()); S.theme = 'custom'; paintThemePress(); refresh(); });
    el.addEventListener('change', () => { save(); paintAll(); });
    paints.push(() => { el.value = get(); });
  };
  bind('#colBg', () => S.cols.bg, v => { S.cols.bg = v; });
  bind('#colInk', () => S.cols.ink, v => { S.cols.ink = v; });
  bind('#colCard', () => S.cols.card, v => { S.cols.card = v; });
  bind('#colP0', () => S.cols.p[0], v => { S.cols.p[0] = v; });
  bind('#colP1', () => S.cols.p[1], v => { S.cols.p[1] = v; });
  bind('#colP2', () => S.cols.p[2], v => { S.cols.p[2] = v; });
}
function paintThemePress() { for (const b of $('#themeCards').children) b.setAttribute('aria-pressed', String(b.dataset.id === S.theme)); }

/* ── text tab ── */
function buildText() {
  seg($('#segTextMode'), [['none', 'Без текста'], ['title', 'Заголовок'], ['sub', 'С подзаголовком']], () => S.text.mode, v => { S.text.mode = v; save(); });
  seg($('#segWeight'), [['light', 'Light'], ['regular', 'Regular'], ['medium', 'Medium']], () => S.text.weight, v => { S.text.weight = v; save(); });
  seg($('#segTextPos'), [['top', 'Сверху'], ['bottom', 'Снизу']], () => S.text.pos, v => { S.text.pos = v; save(); });
  seg($('#segWebStyle'), [['bar', 'Линия'], ['pill', 'Плашка'], ['big', 'Крупно']], () => S.text.webStyle, v => { S.text.webStyle = v; save(); });
  slider($('#slTitle'), { id: 'tscale', l: 'Кегль заголовка', min: 0.5, max: 1.8, step: 0.01, f: pct, get: () => S.text.scale, set: v => { S.text.scale = v; } });
  const txt = (id, k) => { const el = $(id); el.addEventListener('input', () => { S.text[k] = el.value; refresh(); }); el.addEventListener('change', save); paints.push(() => { if (document.activeElement !== el) el.value = S.text[k]; }); };
  txt('#txtTitle', 'title'); txt('#txtSub', 'sub'); txt('#txtEyebrow', 'eyebrowText');
  txt('#txtWebLabel', 'webLabel'); txt('#txtWebDate', 'webDate'); txt('#txtWebTime', 'webTime');
  check($('#chkEyebrow'), () => S.text.eyebrow, v => { S.text.eyebrow = v; });
  check($('#chkWeb'), () => S.text.web, v => { S.text.web = v; });
  seg($('#segLogoPos'), [['tl', '↖ Слева сверху'], ['tr', '↗ Справа сверху'], ['bl', '↙ Слева снизу'], ['br', '↘ Справа снизу']], () => (S.logo.x == null ? S.logo.corner : ''), v => { S.logo.corner = v; S.logo.x = S.logo.y = null; save(); });
  slider($('#slLogo'), { id: 'logoSize', l: 'Ширина логотипа', min: 0.05, max: 0.6, step: 0.005, f: pct, get: () => S.logo.size, set: v => { S.logo.size = v; } });
}
function paintTextVisibility() {
  const m = S.text.mode;
  $('#grpTitle').classList.toggle('off', m === 'none');
  $('#grpSub').hidden = m !== 'sub';
  $('#grpExtra').classList.toggle('off', m === 'none');
  $('#eyebrowOpts').hidden = !S.text.eyebrow;
  $('#webOpts').hidden = !S.text.web;
  $('#logoOpts').hidden = !logo; $('#btnLogoDel').hidden = !logo;
}

/* ── photo tab ── */
function buildPhoto() {
  seg($('#segPhotoMode'), [['under', 'Полосы поверх'], ['over', 'Фото поверх'], ['mask', 'Фото в полосах']], () => S.photo.mode, v => { S.photo.mode = v; save(); });
  seg($('#segPhotoShape'), [['rect', 'Прямоугольник'], ['slant', 'Скос'], ['cut', 'Срезанные углы']], () => S.photo.shape, v => { S.photo.shape = v; save(); });
  seg($('#segPhotoTone'), [['none', 'Как есть'], ['mono', 'Ч/б'], ['duo', 'В цвет темы']], () => S.photo.tone, v => { S.photo.tone = v; save(); });
  slider($('#slPhoto'), { id: 'photoS', l: 'Высота фото', min: 0.15, max: 1.4, step: 0.01, f: pct, get: () => S.photo.s, set: v => { S.photo.s = v; } });
}
function paintPhoto() {
  $('#photoOpts').classList.toggle('off', !photo);
  $('#btnPhotoDel').hidden = !photo;
  $('#photoThumb').hidden = !photo;
  if (photo && $('#photoThumb').src !== photo.src) $('#photoThumb').src = photo.src;
  $('#photoBtnLabel').textContent = photo ? 'Заменить фото' : 'Добавить фото';
}
function fitPhotoToField() {
  if (!photo) return;
  const f = fmt(), L = layoutOf(f.w, f.h, S.layout, S.fsize), F = L.F;
  const hMax = F.h * 0.86, wMax = F.w * 0.86, ar = photo.w / photo.h;
  let h = hMax; if (h * ar > wMax) h = wMax / ar;
  S.photo.s = h / f.h;
  S.photo.x = (F.x + F.w / 2) / f.w;
  S.photo.y = (F.y + F.h - h / 2) / f.h;
  if (S.layout === 'card' || S.layout === 'full' || ['top'].includes(S.layout)) S.photo.y = (F.y + F.h / 2) / f.h;
}
async function loadImageFile(file, maxSide) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let w = img.naturalWidth || 1000, h = img.naturalHeight || 1000;
    const k = Math.min(1, maxSide / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
    let alpha = false;
    if (/png|webp|svg|gif/.test(file.type)) { const d = x.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) { alpha = true; break; } }
    const src = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
    return { img: c, w, h, src, alpha, id: Math.random().toString(36).slice(2) };
  } finally { URL.revokeObjectURL(url); }
}
async function imageFromDataUrl(src) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
  return { img: c, w: c.width, h: c.height, src, alpha: /^data:image\/png/.test(src), id: Math.random().toString(36).slice(2) };
}

/* ── format tab ── */
function buildFormat() {
  seg($('#segFormat'), FORMATS.map(f => [f.id, f.name]), () => S.fmt, v => {
    S.fmt = v; const f = fmt();
    if (f.h > f.w && (S.layout === 'right' || S.layout === 'left')) S.layout = 'bottom';
    if (f.w > f.h * 1.3 && (S.layout === 'bottom' || S.layout === 'top')) S.layout = 'right';
    if (photo) fitPhotoToField();
    sizeFrame(); renderLayoutCards(); save();
  });
  slider($('#slLayout'), { id: 'fsize', l: 'Доля полос', min: 0.25, max: 0.85, step: 0.01, f: pct, get: () => S.fsize, set: v => { S.fsize = v; }, change: () => renderLayoutCards() });
  seg($('#segLoop'), [[6, '6 с'], [8, '8 с'], [10, '10 с'], [12, '12 с'], [16, '16 с']], () => S.loop, v => { S.loop = v; save(); });
  seg($('#segPngScale'), [[1, '× 1'], [2, '× 2']], () => S.pngScale, v => { S.pngScale = v; save(); });
  seg($('#segVfmt'), [['mp4', 'MP4'], ['webm', 'WebM']], () => S.vidFmt, v => { S.vidFmt = v; save(); });
  seg($('#segVfps'), [[30, '30 к/с'], [60, '60 к/с']], () => S.vidFps, v => { S.vidFps = v; save(); });
  seg($('#segVq'), [['light', 'Лёгкое'], ['high', 'Хорошее'], ['max', 'Максимум']], () => S.vidQ, v => { S.vidQ = v; save(); });
  seg($('#segGsize'), [['third', '33 %'], ['half', '50 %'], ['full', '100 %']], () => S.gifSize, v => { S.gifSize = v; save(); });
  seg($('#segGfps'), [[15, '15 к/с'], [20, '20 к/с'], [25, '25 к/с']], () => S.gifFps, v => { S.gifFps = v; save(); });
}
function paintInfo() {
  const f = fmt();
  $('#fmtInfo').textContent = `${f.w} × ${f.h} · ${f.hint}`;
  $('#btnPngSize').textContent = `${f.w * S.pngScale}×${f.h * S.pngScale}`;
  $('#slLayout').classList.toggle('off', S.layout === 'full');
  paintVideo(); paintGifInfo();
  const cm = $('#colorModeNote'); if (cm) cm.textContent = COLOR_NOTES[S.color] || '';
  $('#glowNote').classList.toggle('warn', S.glow > 0 && !canFilter());
  $('#glowNote').textContent = S.glow > 0 && !canFilter() ? 'Этот браузер не рисует свечение в предпросмотре и PNG. В SVG оно будет.' : 'Мягкий ореол вокруг полос. Лучше всего на тёмных темах.';
}

/* ── colour tab extras ── */
function buildColorExtras() {
  seg($('#segColorMode'), COLOR_MODES, () => S.color, v => { S.color = v; save(); });
  seg($('#segFade'), [['none', 'Нет'], ['up', 'Вверх'], ['down', 'Вниз'], ['left', 'Влево'], ['right', 'Вправо'], ['out', 'От центра']], () => S.fade.dir, v => { S.fade.dir = v; save(); });
  const fl = slider($('#slFade'), { id: 'fadeLen', l: 'Длина затухания', min: 0.1, max: 1, step: 0.01, f: pct, get: () => S.fade.len, set: v => { S.fade.len = v; } });
  paints.push(() => { fl.classList.toggle('off', S.fade.dir === 'none'); });
  slider($('#slGlow'), { id: 'glow', l: 'Сила свечения', min: 0, max: 1, step: 0.01, f: v => (v ? pct(v) : 'нет'), get: () => S.glow, set: v => { S.glow = v; }, after: paintInfo });
}

/* ── tabs ── */
function showTab(name) {
  S.tab = name;
  for (const b of $('#tabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const p of document.querySelectorAll('.pane')) p.hidden = p.dataset.pane !== name;
  save();
}

/* ── canvas sizing, drawing and overlay ── */
function sizeFrame() {
  const f = fmt();
  frameEl.style.setProperty('--aw', f.w); frameEl.style.setProperty('--ah', f.h);
  const r = frameEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round((r.width * dpr * f.h) / f.w));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  view.scale = w / f.w; view.dpr = dpr;
  ov.setAttribute('viewBox', `0 0 ${f.w} ${f.h}`);
  refresh();
}
let lastScene = null, dirty = true;
function draw() { lastScene = renderTo(cv, view.scale, tNow); drawOverlay(); dirty = false; }
function refresh() { dirty = true; if (!playing) requestAnimationFrame(() => { if (dirty) draw(); }); paintScrub(); }
function drawOverlay() {
  const sc = lastScene; if (!sc) return;
  const k = 1 / view.scale * view.dpr, parts = [];
  const hd = 7 * k;
  if (sc.pr) {
    const R = sc.pr;
    parts.push(`<g class="${drag && drag.kind === 'photo' ? '' : 'idle'}"><rect class="sel" x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}"/><rect class="hd" x="${R.x + R.w - hd}" y="${R.y + R.h - hd}" width="${hd * 2}" height="${hd * 2}"/></g>`);
  }
  if (sc.lr) { const R = sc.lr; parts.push(`<g class="idle"><rect class="sel" x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}"/></g>`); }
  const fp = focusPoint(sc);
  if (fp) {
    const r = 12 * k;
    parts.push(`<g class="${drag && drag.kind === 'focus' ? '' : 'idle'}"><circle class="dot" cx="${fp.x}" cy="${fp.y}" r="${r * 0.45}"/><path class="cross" d="M${fp.x - r * 1.6} ${fp.y}h${r * 0.9}M${fp.x + r * 0.7} ${fp.y}h${r * 0.9}M${fp.x} ${fp.y - r * 1.6}v${r * 0.9}M${fp.x} ${fp.y + r * 0.7}v${r * 0.9}"/></g>`);
  }
  ov.innerHTML = parts.join('');
}
function focusPoint(sc) {
  const F = sc.F;
  if (gen() === 'surface') return { x: F.x + S.g.fx * F.w, y: F.y + S.g.fy * F.h, kind: 'orbit' };
  if (S.mask.shape !== 'none') return { x: F.x + S.mask.x * F.w, y: F.y + S.mask.y * F.h, kind: 'mask' };
  return null;
}

/* pointer: photo (move / resize), logo, then the move's centre or window */
let drag = null;
function toFmt(ev) { const r = cv.getBoundingClientRect(), f = fmt(); return { x: ((ev.clientX - r.left) / r.width) * f.w, y: ((ev.clientY - r.top) / r.height) * f.h }; }
function hitTest(p, shift) {
  const sc = lastScene; if (!sc) return null;
  const k = (1 / view.scale) * view.dpr, hd = 12 * k;
  if (sc.lr) { const R = sc.lr; if (p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h) return { kind: 'logo' }; }
  if (sc.pr) {
    const R = sc.pr;
    if (Math.abs(p.x - (R.x + R.w)) < hd && Math.abs(p.y - (R.y + R.h)) < hd) return { kind: 'photoSize' };
    if (p.x >= R.x && p.x <= R.x + R.w && p.y >= R.y && p.y <= R.y + R.h) return { kind: 'photo' };
  }
  const fp = focusPoint(sc);
  if (fp) { const F = sc.F; if (p.x >= F.x && p.x <= F.x + F.w && p.y >= F.y && p.y <= F.y + F.h) return { kind: fp.kind === 'orbit' ? (shift ? 'focus' : 'orbit') : fp.kind }; }
  return null;
}
frameEl.addEventListener('pointermove', ev => {
  if (drag) return;
  const h = hitTest(toFmt(ev), ev.shiftKey);
  frameEl.classList.toggle('grab', !!h && h.kind !== 'photoSize');
  frameEl.classList.toggle('rs', !!h && h.kind === 'photoSize');
});
frameEl.addEventListener('pointerdown', ev => {
  if (busy) return;
  const p = toFmt(ev), h = hitTest(p, ev.shiftKey); if (!h) return;
  const f = fmt();
  drag = { kind: h.kind, p0: p, photo: Object.assign({}, S.photo), logoR: lastScene.lr && Object.assign({}, lastScene.lr), g: { fx: S.g.fx, fy: S.g.fy, yaw: S.g.yaw, pitch: S.g.pitch }, mask: Object.assign({}, S.mask), f };
  frameEl.setPointerCapture(ev.pointerId); frameEl.classList.add('dragging');
  ev.preventDefault();
});
frameEl.addEventListener('pointermove', ev => {
  if (!drag) return;
  const p = toFmt(ev), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y, f = drag.f, F = lastScene.F;
  if (drag.kind === 'photo') { S.photo.x = drag.photo.x + dx / f.w; S.photo.y = drag.photo.y + dy / f.h; }
  else if (drag.kind === 'photoSize') {
    const R0 = photoRectFrom(drag.photo, f), cx = R0.x + R0.w / 2, cy = R0.y + R0.h / 2;
    const top = R0.y, newH = Math.max(f.h * 0.08, (p.y - top));
    const ar = R0.w / R0.h, newW = newH * ar;
    S.photo.s = newH / f.h; S.photo.x = (R0.x + newW / 2) / f.w; S.photo.y = (top + newH / 2) / f.h;
    void cx; void cy;
  } else if (drag.kind === 'logo') {
    const R = drag.logoR; S.logo.x = (R.x + R.w / 2 + dx) / f.w; S.logo.y = (R.y + R.h / 2 + dy) / f.h;
  } else if (drag.kind === 'mask') { S.mask.x = drag.mask.x + dx / F.w; S.mask.y = drag.mask.y + dy / F.h; }
  else if (drag.kind === 'focus') { S.g.fx = drag.g.fx + dx / F.w; S.g.fy = drag.g.fy + dy / F.h; }
  else if (drag.kind === 'orbit') {
    let y = drag.g.yaw + (dx / F.w) * 220; y = ((((y + 180) % 360) + 360) % 360) - 180;
    S.g.yaw = Math.round(y); S.g.pitch = Math.round(clamp(drag.g.pitch - (dy / F.h) * 160, -89, 89));
    for (const p of movePaints) p();
  }
  refresh(); if (!playing) draw();
});
function photoRectFrom(ph, f) { const h = ph.s * f.h, ar = photo.w / photo.h, w = h * ar; return { x: ph.x * f.w - w / 2, y: ph.y * f.h - h / 2, w, h }; }
const endDrag = () => { if (!drag) return; drag = null; frameEl.classList.remove('dragging'); save(); paintAll(); refresh(); };
frameEl.addEventListener('pointerup', endDrag);
frameEl.addEventListener('pointercancel', endDrag);

/* ── playback ── */
function setPlaying(on) {
  playing = on;
  $('#btnPlay').setAttribute('aria-pressed', String(on));
  $('#btnPlayLabel').textContent = on ? 'Пауза' : 'Играть';
  $('#playIcon').setAttribute('d', on ? 'M2 1h3v10H2zM7 1h3v10H7z' : 'M2 1l9 5-9 5z');
  lastTs = 0;
  if (on) requestAnimationFrame(tick); else refresh();
}
function tick(ts) {
  if (!playing) return;
  if (!busy) {
    if (lastTs) tNow = fract(tNow + (ts - lastTs) / 1000 / S.loop);
    lastTs = ts;
    draw(); paintScrub();
  } else lastTs = ts;
  requestAnimationFrame(tick);
}
function paintScrub() { $('#scrub').value = tNow; setP($('#scrub')); $('#scrubOut').textContent = comma(tNow * S.loop, 1) + ' с'; }

/* ───────────────────────── 7. export ───────────────────────── */
async function saveFile(filename, blob) {
  if (window.claude && typeof window.claude.use === 'function') {
    let ns = null;
    try { ns = await window.claude.use('downloads'); } catch (e) { ns = null; }
    if (ns) {
      try { await ns.save({ filename, data: blob }); return 'saved'; }
      catch (e) {
        const code = e && e.code;
        if (code === 'declined') return 'declined';
        if (code === 'rate_limited') return 'busy';
        if (code === 'too_large') return 'too_large';
        return 'failed';
      }
    }
  }
  try {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return 'saved';
  } catch (e) { return 'failed'; }
}
const SAVE_TEXT = {
  declined: 'Сохранение отменено. Файл готов, можно сохранить ещё раз.',
  busy: 'Окно сохранения уже открыто. Закройте его и нажмите «Сохранить ещё раз».',
  too_large: 'Файл слишком большой для этого просмотра. Уменьшите размер или частоту кадров.',
  failed: 'Здесь сохранить файл не получилось. Откройте страницу в браузере и попробуйте снова.',
};
function stamp() { const d = new Date(), p = v => String(v).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
const fmtMb = b => (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' КБ' : (b / 1048576 < 10 ? comma(b / 1048576, 1) : Math.round(b / 1048576)) + ' МБ');
function status(text, o = {}) {
  const box = $('#status');
  box.hidden = !text;
  $('#statusText').textContent = text || '';
  box.classList.toggle('warn', !!o.warn); box.classList.toggle('done', !!o.done);
  $('#statusBar').hidden = o.progress == null;
  if (o.progress != null) $('#statusFill').style.width = (o.progress * 100).toFixed(1) + '%';
  $('#btnCancel').hidden = !o.cancel;
  $('#btnRetry').hidden = !o.retry;
}
function setBusy(on) {
  busy = on; $('.panel').inert = on;
  for (const id of ['btnPng', 'btnSvg', 'btnGif', 'btnPlay']) $('#' + id).disabled = on;
  $('#btnVid').disabled = on || (video.probed && !video.ok);
}
let lastFile = null, cancel = false;
async function offer(name, blob, okText) {
  lastFile = { name, blob, okText };
  const r = await saveFile(name, blob);
  if (r === 'saved') status(okText, { done: true });
  else status(SAVE_TEXT[r] || SAVE_TEXT.failed, { retry: r !== 'too_large', warn: true });
}
const baseName = () => `pbonus-${S.preset}-${S.fmt}`;

async function exportPng() {
  if (busy) return;
  setBusy(true);
  try {
    const f = fmt(), sc = S.pngScale, w = f.w * sc, h = f.h * sc;
    status(`Готовлю PNG ${w} × ${h}…`, {});
    await nextFrame();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    renderTo(c, sc, tNow);
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (!blob) throw new Error('no blob');
    await offer(`${baseName()}-${stamp()}.png`, blob, `PNG сохранён · ${w} × ${h} · ${fmtMb(blob.size)}`);
  } catch (e) { console.error(e); status('Не получилось собрать PNG. Попробуйте размер × 1.', { warn: true }); }
  finally { setBusy(false); refresh(); }
}
async function exportSvg() {
  if (busy) return;
  setBusy(true);
  try {
    const s = svgString(tNow), blob = new Blob([s], { type: 'image/svg+xml' });
    await offer(`${baseName()}-${stamp()}.svg`, blob, `SVG сохранён · текст в кривых · ${fmtMb(blob.size)}`);
  } catch (e) { console.error(e); status('Не получилось собрать SVG.', { warn: true }); }
  finally { setBusy(false); refresh(); }
}

const video = { ok: false, mp4: false, webm: false, probed: false };
const VIDEO_BPP = { light: 0.06, high: 0.12, max: 0.24 };
function vidDims() {
  const f = fmt(), w = Math.round(f.w / 2) * 2, h = Math.round(f.h / 2) * 2, fps = S.vidFps;
  let bitrate = w * h * 30 * VIDEO_BPP[S.vidQ] * Math.pow(fps / 30, 0.6);
  if (S.vidFmt === 'webm') bitrate *= 0.7;
  return { w, h, fps, frames: Math.round(fps * S.loop), bitrate: Math.round(bitrate) };
}
function codecCandidates(fmtId, w, h, fps) {
  if (fmtId === 'webm') return ['vp09.00.40.08', 'vp09.00.41.08', 'vp09.00.50.08'];
  const out = [];
  for (const level of (w * h * fps > 1920 * 1080 * 30 ? ['2A', '32', '33'] : ['28', '2A', '32', '33'])) for (const prof of ['6400', '4D00', '42E0', '4200']) out.push('avc1.' + prof + level);
  return out;
}
async function pickCodec(fmtId, w, h, fps, bitrate) {
  for (const codec of codecCandidates(fmtId, w, h, fps)) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', bitrateMode: 'variable' };
    if (fmtId === 'mp4') cfg.avc = { format: 'avc' };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r && r.supported) return cfg; } catch (e) { /* next */ }
  }
  return null;
}
async function probeVideo() {
  if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined') {
    video.mp4 = !!(await pickCodec('mp4', 1080, 1920, 30, 4e6));
    video.webm = !!(await pickCodec('webm', 1080, 1920, 30, 3e6));
  }
  video.ok = video.mp4 || video.webm; video.probed = true;
  if (video.ok && !video[S.vidFmt]) S.vidFmt = video.mp4 ? 'mp4' : 'webm';
  paintAll();
}
function paintVideo() {
  if (video.probed) for (const b of $('#segVfmt').children) b.disabled = !video[b.dataset.v];
  const { w, h, fps, frames, bitrate } = vidDims();
  $('#btnVidFmt').textContent = S.vidFmt === 'mp4' ? 'MP4' : 'WebM';
  $('#btnVid').disabled = busy || (video.probed && !video.ok);
  $('#vidOpts').classList.toggle('off', video.probed && !video.ok);
  $('#vidInfo').textContent = video.probed && !video.ok
    ? 'Этот браузер не умеет кодировать видео. Откройте страницу в свежем Chrome, Edge или Safari.'
    : `${w} × ${h} · ${fps} к/с · ${frames} кадров · ${comma(bitrate / 1e6, 1)} Мбит/с · примерно ${fmtMb((bitrate * S.loop) / 8)}`;
}
async function exportVideo() {
  if (busy || !video.ok) return;
  const wasPlaying = playing, fmtId = S.vidFmt, { w, h, fps, frames, bitrate } = vidDims(), f = fmt();
  setBusy(true); cancel = false;
  let enc = null;
  try {
    status('Готовлю кодировщик…', { progress: 0, cancel: true });
    await nextFrame();
    const cfg = await pickCodec(fmtId, w, h, fps, bitrate);
    if (!cfg) { status(`Браузер не кодирует ${fmtId === 'mp4' ? 'MP4 (H.264)' : 'WebM (VP9)'} в размере ${w} × ${h} при ${fps} к/с. Выберите другой формат или 30 к/с.`, { warn: true }); return; }
    const kind = cfg.codec.startsWith('avc1') ? 'avc' : 'vp9';
    const muxer = fmtId === 'mp4'
      ? new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: kind, width: w, height: h, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' })
      : new WebMMuxer.Muxer({ target: new WebMMuxer.ArrayBufferTarget(), video: { codec: 'V_VP9', width: w, height: h, frameRate: fps }, firstTimestampBehavior: 'offset' });
    let failed = null;
    enc = new VideoEncoder({ output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { failed = failed || e; } }, error: e => { failed = failed || e; } });
    enc.configure(cfg);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const sc = w / f.w, dur = 1e6 / fps;
    let last = performance.now();
    for (let i = 0; i < frames; i++) {
      if (cancel || failed) break;
      renderTo(c, sc, i / frames);
      const vf = new VideoFrame(c, { timestamp: Math.round(i * dur), duration: Math.round(dur) });
      enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      while (enc.encodeQueueSize > 3 && !failed) await new Promise(r => setTimeout(r, 2));
      if (performance.now() - last > 80 || i === frames - 1) {
        status(`Видео: кадр ${i + 1} из ${frames}`, { progress: (i + 1) / frames, cancel: true });
        tNow = i / frames; draw(); paintScrub();
        await breathe(); last = performance.now();
      }
    }
    if (failed) throw failed;
    if (cancel) { status('Экспорт видео остановлен.', {}); return; }
    await enc.flush();
    if (failed) throw failed;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: fmtId === 'mp4' ? 'video/mp4' : 'video/webm' });
    await offer(`${baseName()}-${stamp()}.${fmtId}`, blob, `Видео сохранено · ${fmtId === 'mp4' ? 'MP4' : 'WebM'} · ${w} × ${h} · ${fps} к/с · ${S.loop} с · ${fmtMb(blob.size)}`);
  } catch (e) {
    console.error(e);
    status('Кодировщик видео остановился с ошибкой. Попробуйте другой формат или 30 к/с.', { warn: true });
  } finally {
    try { if (enc && enc.state !== 'closed') enc.close(); } catch (e) { /* closed */ }
    setBusy(false);
    if (wasPlaying) setPlaying(true);
    refresh();
  }
}
function gifDims() {
  const f = fmt(), k = { third: 1 / 3, half: 0.5, full: 1 }[S.gifSize] || 0.5;
  return { w: Math.round(f.w * k), h: Math.round(f.h * k), frames: Math.round(S.gifFps * S.loop), delay: Math.round(1000 / S.gifFps) };
}
function paintGifInfo() { const { w, h, frames } = gifDims(); $('#gifInfo').textContent = `${w} × ${h} · ${frames} кадров · ${S.loop} с`; }
async function exportGif() {
  if (busy) return;
  const wasPlaying = playing, { w, h, frames, delay } = gifDims(), f = fmt();
  setBusy(true); cancel = false;
  try {
    status('Подбираю цвета…', { progress: 0, cancel: true });
    await nextFrame();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true }), sc = w / f.w;
    const n = 8, sample = new Uint8Array(w * h * 4 * n);
    for (let i = 0; i < n; i++) { renderTo(c, sc, i / n); sample.set(ctx.getImageData(0, 0, w, h).data, i * w * h * 4); }
    const palette = GIFENC.quantize(sample, 256, { format: 'rgb565' });
    const gif = GIFENC.GIFEncoder({ initialCapacity: 1 << 22 });
    let last = performance.now();
    for (let i = 0; i < frames; i++) {
      if (cancel) break;
      renderTo(c, sc, i / frames);
      const idx = GIFENC.applyPalette(ctx.getImageData(0, 0, w, h).data, palette, 'rgb565');
      gif.writeFrame(idx, w, h, i === 0 ? { palette, delay, repeat: 0 } : { delay });
      if (performance.now() - last > 80 || i === frames - 1) {
        status(`GIF: кадр ${i + 1} из ${frames}`, { progress: (i + 1) / frames, cancel: true });
        tNow = i / frames; draw(); paintScrub();
        await breathe(); last = performance.now();
      }
    }
    if (cancel) { status('Экспорт GIF остановлен.', {}); return; }
    gif.finish();
    const blob = new Blob([gif.bytesView()], { type: 'image/gif' });
    await offer(`${baseName()}-${stamp()}.gif`, blob, `GIF сохранён · ${w} × ${h} · ${S.loop} с · ${fmtMb(blob.size)}`);
  } catch (e) { console.error(e); status('Не хватило памяти на такой GIF. Выберите размер поменьше.', { warn: true }); }
  finally { setBusy(false); if (wasPlaying) setPlaying(true); refresh(); }
}

/* ───────────────────────── boot ───────────────────────── */
function wire() {
  for (const b of $('#tabs').children) b.addEventListener('click', () => showTab(b.dataset.tab));
  $('#btnPlay').addEventListener('click', () => setPlaying(!playing));
  $('#scrub').addEventListener('input', () => { if (playing) setPlaying(false); tNow = +$('#scrub').value % 1; draw(); paintScrub(); });
  $('#btnPng').addEventListener('click', exportPng);
  $('#btnSvg').addEventListener('click', exportSvg);
  $('#btnVid').addEventListener('click', exportVideo);
  $('#btnGif').addEventListener('click', exportGif);
  $('#btnCancel').addEventListener('click', () => { cancel = true; });
  $('#btnRetry').addEventListener('click', async () => { if (lastFile) await offer(lastFile.name, lastFile.blob, lastFile.okText); });
  $('#btnSeed').addEventListener('click', () => { S.g.seed = ((S.g.seed | 0) + 1 + Math.floor(Math.random() * 97)) % 1000; refresh(); save(); });
  $('#btnResetMove').addEventListener('click', () => applyPreset(S.preset));
  $('#photoFile').addEventListener('change', async ev => {
    const file = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!file) return;
    try {
      photo = await loadImageFile(file, 2400); toneMemo.key = '';
      fitPhotoToField();
      try { localStorage.setItem(LS + '.photo', photo.src); } catch (e) { try { localStorage.removeItem(LS + '.photo'); } catch (e2) { /* off */ } }
      paintAll(); refresh(); save();
    } catch (e) { console.error(e); $('#photoNote').textContent = 'Не получилось открыть этот файл. Подойдёт JPG, PNG или WebP.'; }
  });
  $('#btnPhotoDel').addEventListener('click', () => { photo = null; try { localStorage.removeItem(LS + '.photo'); } catch (e) { /* off */ } paintAll(); refresh(); });
  $('#btnPhotoFit').addEventListener('click', () => { fitPhotoToField(); paintAll(); refresh(); save(); });
  $('#logoFile').addEventListener('change', async ev => {
    const file = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!file) return;
    try {
      const L = await loadImageFile(file, 1600); L.alpha = true; L.src = L.img.toDataURL('image/png'); logo = L;
      try { localStorage.setItem(LS + '.logo', logo.src); } catch (e) { /* too big */ }
      paintAll(); refresh();
    } catch (e) { console.error(e); }
  });
  $('#btnLogoDel').addEventListener('click', () => { logo = null; try { localStorage.removeItem(LS + '.logo'); } catch (e) { /* off */ } paintAll(); refresh(); });
  window.addEventListener('keydown', ev => {
    if (ev.code !== 'Space' || busy) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag)) return;
    ev.preventDefault(); setPlaying(!playing);
  });
  new ResizeObserver(() => sizeFrame()).observe($('.stage'));
}
async function start() {
  try {
    fonts.light = opentype.parse(b64ToBuf(FONT_DATA.light));
    fonts.regular = opentype.parse(b64ToBuf(FONT_DATA.regular));
    fonts.medium = opentype.parse(b64ToBuf(FONT_DATA.medium));
  } catch (e) { console.error(e); $('#loading').textContent = 'Шрифт не загрузился. Обновите страницу.'; return; }
  try {
    for (const [id, w] of [['regular', '400'], ['medium', '500']]) {
      const ff = new FontFace('F37 Holborn UI', b64ToBuf(FONT_DATA[id]), { weight: w });
      document.fonts.add(ff); ff.load().catch(() => {});
    }
  } catch (e) { /* UI falls back to system fonts */ }
  loadSaved();
  try { const p = localStorage.getItem(LS + '.photo'); if (p) photo = await imageFromDataUrl(p); } catch (e) { photo = null; }
  try { const l = localStorage.getItem(LS + '.logo'); if (l) { logo = await imageFromDataUrl(l); logo.alpha = true; } } catch (e) { logo = null; }
  buildGallery(); buildMoveControls(); buildText(); buildPhoto(); buildThemes(); buildColorExtras(); buildFormat();
  wire();
  $('#loading').hidden = true;
  showTab(S.tab || 'move');
  sizeFrame();
  paintAll();
  renderThumbs();
  paints.push(renderThumbs);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { tNow = 0.2; setPlaying(false); } else setPlaying(true);
  probeVideo();
}
start();

/* hooks for automated checks */
window.__pb = {
  get S() { return S; }, set S(v) { S = v; }, applyPreset, paintAll, refresh, draw, renderTo, svgString, scene, fmt, showTab, setPlaying, sizeFrame,
  get t() { return tNow; }, set t(v) { tNow = v; draw(); paintScrub(); }, get last() { return lastFile; }, get busy() { return busy; },
  exportPng, exportSvg, exportVideo, exportGif, video, buildMoveControls, fitPhotoToField,
  setPhoto: async src => { photo = await imageFromDataUrl(src); toneMemo.key = ''; fitPhotoToField(); paintAll(); refresh(); },
  setLogo: async src => { logo = await imageFromDataUrl(src); logo.alpha = true; paintAll(); refresh(); },
};
})();
