/**
 * Иллюстрации форматов ретро: исходная PNG → src/lib/assets/format-art/{id}.webp.
 *
 * Одноразовый инструмент; коммитится, чтобы картинки можно было пересобрать. Исходники
 * в репозиторий не кладём (PNG 2172×724 по ~1 МБ): лавандовая карточка со скруглёнными
 * углами на белом поле, иллюстрация справа, слева пусто. Соответствие исходников
 * форматам: img2 → 4l, img3 → mad-sad-glad, img4 → start-stop-continue,
 * img5 → classic, img6 → sailboat. Они лежали в
 * .superpowers/sdd/2026-09-17-bitrix24-integration/format-art-src/ (каталог в .gitignore
 * и удаляется после плана) — если его нет, исходники у владельца репозитория.
 *
 * Запуск из корня репозитория, по одному формату:
 *   node scripts/format-art.mjs <путь к PNG> <id формата>
 *
 * 1. Карточка ищется по цвету, а не по жёстким числам: пиксель карточки — тот, у которого
 *    самый тёмный канал ≤ 249 (белое поле 253–255, лаванда 239–246). Граница — первый
 *    столбец/строка, где таких пикселей больше половины: углы и иллюстрация не мешают.
 * 2. Радиус скругления меряется по диагонали из угла рамки: до карточки d = r·(1 − 1/√2)
 *    белых пикселей, отсюда r. Угол кадра ставится на дугу под 60°: по X внутрь на
 *    r·(1 − cos 60°), по Y — на r·(1 − sin 60°), плюс SAFETY по обеим осям. Такая точка
 *    лежит внутри квадранта, белого в углах нет; по Y режем мельче, потому что сверху и
 *    снизу иллюстрации доходят до края, а слева пусто.
 * 3. Кадр доводится до 3:1: лишняя ширина срезается слева (там пусто), лишняя высота —
 *    поровну сверху и снизу. У всех форматов один размер 1200×400 — одна раскладка плиток.
 * 4. Пустая часть приводится к одному цвету CANVAS (= --color-art-canvas в src/app.css):
 *    каналы сдвигаются на разницу со средним в пустой зоне (5–35 % ширины, 15–85 % высоты).
 *    Плитка шире картинки заливается этим токеном, и шва на стыке нет.
 * 5. WebP quality 80, затем самопроверка: на краях готового файла нет белых пикселей.
 *    Печатает замеры одной строкой JSON; при белом на краю — exit 1.
 */
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { VISIBLE_FORMATS } from '../board-formats.js';

const OUT_W = 1200;
const OUT_H = 400;
const SAFETY = 6;
/** Совпадает с --color-art-canvas (#f4f4fe) в src/app.css */
const CANVAS = [244, 244, 254];

const [src, id] = process.argv.slice(2);
if (!src || !VISIBLE_FORMATS.some((f) => f.id === id)) {
	const ids = VISIBLE_FORMATS.map((f) => f.id).join('|');
	console.error(`usage: node scripts/format-art.mjs <png> <${ids}>`);
	process.exit(1);
}

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const isCard = (x, y) => {
	const i = (y * W + x) * 3;
	return Math.min(data[i], data[i + 1], data[i + 2]) <= 249;
};
const share = (count, total) => count / total;
const colShare = (x) => {
	let n = 0;
	for (let y = 0; y < H; y++) if (isCard(x, y)) n++;
	return share(n, H);
};
const rowShare = (y) => {
	let n = 0;
	for (let x = 0; x < W; x++) if (isCard(x, y)) n++;
	return share(n, W);
};

let left = 0;
while (colShare(left) < 0.5) left++;
let right = W - 1;
while (colShare(right) < 0.5) right--;
let top = 0;
while (rowShare(top) < 0.5) top++;
let bottom = H - 1;
while (rowShare(bottom) < 0.5) bottom--;

const diagonal = (x0, y0, sx, sy) => {
	let t = 0;
	while (!isCard(x0 + sx * t, y0 + sy * t)) t++;
	return t;
};
const radius = Math.round(
	Math.max(
		diagonal(left, top, 1, 1),
		diagonal(right, top, -1, 1),
		diagonal(left, bottom, 1, -1),
		diagonal(right, bottom, -1, -1)
	) / (1 - Math.SQRT1_2)
);
const insetX = Math.ceil(radius * (1 - Math.cos(Math.PI / 3))) + SAFETY;
const insetY = Math.ceil(radius * (1 - Math.sin(Math.PI / 3))) + SAFETY;

let cx = left + insetX;
let cy = top + insetY;
let cw = right - left + 1 - 2 * insetX;
let ch = bottom - top + 1 - 2 * insetY;
if (cw * OUT_H > ch * OUT_W) {
	const w = Math.round((ch * OUT_W) / OUT_H);
	cx += cw - w;
	cw = w;
} else {
	const h = Math.round((cw * OUT_H) / OUT_W);
	cy += Math.floor((ch - h) / 2);
	ch = h;
}

const sum = [0, 0, 0];
let count = 0;
for (let y = cy + Math.round(ch * 0.15); y < cy + Math.round(ch * 0.85); y += 2) {
	for (let x = cx + Math.round(cw * 0.05); x < cx + Math.round(cw * 0.35); x += 2) {
		const i = (y * W + x) * 3;
		for (let c = 0; c < 3; c++) sum[c] += data[i + c];
		count++;
	}
}
const canvas = sum.map((s) => Math.round((s / count) * 10) / 10);
const offset = canvas.map((v, c) => Math.round((CANVAS[c] - v) * 10) / 10);

mkdirSync('src/lib/assets/format-art', { recursive: true });
const out = `src/lib/assets/format-art/${id}.webp`;
await sharp(src)
	.removeAlpha()
	.extract({ left: cx, top: cy, width: cw, height: ch })
	.resize(OUT_W, OUT_H)
	.linear([1, 1, 1], offset)
	.webp({ quality: 80, effort: 6 })
	.toFile(out);

// Самопроверка: белый нейтральный пиксель (все каналы ≥ 251, разброс ≤ 3) на краю кадра
// значит, что угол карточки или поле попали в картинку
const res = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => {
	const i = (y * res.info.width + x) * 3;
	return [res.data[i], res.data[i + 1], res.data[i + 2]];
};
const isWhite = ([r, g, b]) => Math.min(r, g, b) >= 251 && Math.max(r, g, b) - Math.min(r, g, b) <= 3;
let whiteEdge = 0;
for (let x = 0; x < res.info.width; x++) {
	if (isWhite(px(x, 0))) whiteEdge++;
	if (isWhite(px(x, res.info.height - 1))) whiteEdge++;
}
for (let y = 0; y < res.info.height; y++) {
	if (isWhite(px(0, y))) whiteEdge++;
	if (isWhite(px(res.info.width - 1, y))) whiteEdge++;
}

console.log(
	JSON.stringify({
		id,
		card: { left, top, right, bottom },
		radius,
		inset: { x: insetX, y: insetY },
		crop: { x: cx, y: cy, w: cw, h: ch },
		canvas,
		offset,
		size: `${res.info.width}x${res.info.height}`,
		bytes: statSync(out).size,
		whiteEdge
	})
);
if (whiteEdge > 0) process.exit(1);
