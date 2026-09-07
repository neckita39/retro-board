import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { INDEXABLE_PATHS, CRAWLER_FILES, isIndexable } from './seo.js';
import { FORMATS } from './content/formats.js';

const robots = readFileSync('static/robots.txt', 'utf-8');
const allowLines = robots
	.split('\n')
	.filter((l) => l.startsWith('Allow:'))
	.map((l) => l.replace('Allow:', '').trim());

describe('isIndexable', () => {
	it('открывает главную', () => {
		expect(isIndexable('/')).toBe(true);
	});

	it('открывает контентные страницы', () => {
		expect(isIndexable('/formats')).toBe(true);
		expect(isIndexable('/formats/start-stop-continue')).toBe(true);
		expect(isIndexable('/how-to-run-a-retro')).toBe(true);
		expect(isIndexable('/changelog')).toBe(true);
	});

	it('закрывает доски — они защищены только ссылкой', () => {
		expect(isIndexable('/GDyCkwD0Ks5mS3qyYkGY-')).toBe(false);
		expect(isIndexable('/V1StGXR8_Z5jdHi6B-myT')).toBe(false);
	});

	it('закрывает пространства и их вложенные адреса', () => {
		expect(isIndexable('/spaces/GDyCkwD0Ks5mS3qyYkGY-')).toBe(false);
		expect(isIndexable('/spaces')).toBe(false);
	});

	it('закрывает служебные маршруты', () => {
		expect(isIndexable('/new')).toBe(false);
		expect(isIndexable('/feedback')).toBe(false);
		expect(isIndexable('/api/upload')).toBe(false);
	});

	it('не закрывает неизвестный формат — его отсеивает 404, а не заголовок', () => {
		expect(isIndexable('/formats/nonexistent')).toBe(false);
	});

	it('нормализует хвостовой слэш', () => {
		expect(isIndexable('/formats/')).toBe(true);
		expect(isIndexable('/how-to-run-a-retro/')).toBe(true);
		expect(isIndexable('/')).toBe(true);
	});

	it('отбрасывает query и hash — server.js передаёт сырой req.url', () => {
		expect(isIndexable('/?utm_source=yandex')).toBe(true);
		expect(isIndexable('/formats?x=1')).toBe(true);
		expect(isIndexable('/GDyCkwD0Ks5mS3qyYkGY-?admin=token')).toBe(false);
	});

	it('пропускает файлы, по которым ходит сам краулер', () => {
		for (const file of CRAWLER_FILES) {
			expect(isIndexable(file)).toBe(true);
		}
	});
});

describe('согласованность списков', () => {
	it('в robots.txt есть Allow на каждый индексируемый путь', () => {
		for (const path of INDEXABLE_PATHS) {
			// У главной в robots особый вид записи: Allow: /$
			const expected = path === '/' ? '/$' : path;
			expect(allowLines).toContain(expected);
		}
	});

	it('robots.txt закрывает всё остальное', () => {
		expect(robots).toMatch(/^Disallow: \/$/m);
	});

	it('каждый формат из контента открыт для индексации', () => {
		for (const format of FORMATS) {
			expect(INDEXABLE_PATHS).toContain(`/formats/${format.slug}`);
		}
	});

	it('нет индексируемых путей, ведущих на доски или пространства', () => {
		for (const path of INDEXABLE_PATHS) {
			expect(path.startsWith('/spaces')).toBe(false);
		}
	});
});
