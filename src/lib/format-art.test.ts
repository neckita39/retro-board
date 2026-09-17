import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { formatArt, formatArtBackground } from './format-art.js';
import { VISIBLE_FORMATS, ANALYSIS_FORMAT } from './formats.js';
import { FORMATS } from './content/formats.js';

describe('иллюстрации форматов', () => {
	it('у каждого формата из пикера, включая classic, есть картинка со своим id в имени', () => {
		for (const f of VISIBLE_FORMATS) {
			// В тестах это /src/lib/assets/format-art/4l.webp, в сборке — 4l.<хеш>.webp
			expect(formatArt(f.id)).toMatch(new RegExp(`/${f.id}\\.([\\w-]+\\.)?webp$`));
		}
	});

	it('у каждой страницы формата есть картинка — плитки /formats, главной и гайда без неё не останутся', () => {
		for (const seo of FORMATS) expect(formatArt(seo.slug)).not.toBeNull();
	});

	it('у скрытого analysis и неизвестных id картинки нет', () => {
		expect(formatArt(ANALYSIS_FORMAT)).toBeNull();
		expect(formatArt('nope')).toBeNull();
		expect(formatArt('')).toBeNull();
		expect(formatArtBackground(ANALYSIS_FORMAT)).toBeUndefined();
	});

	it('фон — CSS url() от того же файла', () => {
		expect(formatArtBackground('sailboat')).toBe(`url("${formatArt('sailboat')}")`);
	});

	it('в каталоге ровно по файлу на видимый формат — осиротевших картинок нет', () => {
		// Скрытые файлы не в счёт: Finder кладёт сюда .DS_Store (он в .gitignore). Фильтр не по
		// расширению — забытый .png или .jpg тест должен ловить
		const files = readdirSync('src/lib/assets/format-art').filter((f) => !f.startsWith('.')).sort();
		expect(files).toEqual(VISIBLE_FORMATS.map((f) => `${f.id}.webp`).sort());
	});
});
