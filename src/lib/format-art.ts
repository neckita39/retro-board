// Иллюстрации форматов ретро — фон плиток на /formats, главной, /how-to-run-a-retro
// и в FormatPicker. Файлы src/lib/assets/format-art/{id}.webp (1200×400) делает
// scripts/format-art.mjs; id файла = id формата в board-formats.js = slug страницы.
//
// Через Vite, а не static/: в сборке имя файла получает хеш и отдаётся из
// /_app/immutable/ с Cache-Control immutable на год (файлы из static/ adapter-node
// отдаёт только с ETag), а /_app/ уже открыт в robots.txt.
const FILES = import.meta.glob('./assets/format-art/*.webp', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

/** URL иллюстрации формата или null — у скрытого analysis и неизвестных id её нет */
export function formatArt(id: string): string | null {
	return FILES[`./assets/format-art/${id}.webp`] ?? null;
}

/** Значение для style:background-image; undefined — Svelte не ставит свойство вовсе */
export function formatArtBackground(id: string): string | undefined {
	const src = formatArt(id);
	return src ? `url("${src}")` : undefined;
}
