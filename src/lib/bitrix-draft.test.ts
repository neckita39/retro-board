import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

import { buildTaskDraft, type DraftInput } from './bitrix-draft.js';

const ru: DraftInput = {
	card: {
		content: 'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
		authorName: 'Мария',
		imageId: null
	},
	board: { title: 'Спринт 42', slug: 'abc123', format: 'classic' },
	columnTitle: 'Не получилось',
	comments: [
		{ authorName: 'Пётр', content: 'Согласен', imageId: null },
		{ authorName: null, content: 'Только не в релизную неделю', imageId: null }
	],
	likes: 3,
	dislikes: 1,
	origin: 'https://retro.test',
	locale: 'ru'
};

const en: DraftInput = {
	...ru,
	card: { ...ru.card, authorName: 'Maria' },
	board: { ...ru.board, title: 'Sprint 42' },
	columnTitle: "Didn't Go Well",
	comments: [{ authorName: 'Peter', content: 'Agreed', imageId: null }],
	locale: 'en'
};

function withCard(base: DraftInput, card: Partial<DraftInput['card']>): DraftInput {
	return { ...base, card: { ...base.card, ...card } };
}

describe('buildTaskDraft — название', () => {
	it('первая непустая строка карточки без пробелов по краям', () => {
		const draft = buildTaskDraft(withCard(ru, { content: '\n   \n  Релизы по пятницам  \nвторая строка' }));
		expect(draft.title).toBe('Релизы по пятницам');
	});

	it('строка ровно в 100 символов остаётся без многоточия', () => {
		const line = 'x'.repeat(100);
		expect(buildTaskDraft(withCard(ru, { content: line })).title).toBe(line);
	});

	it('длинная строка режется по границе слова и получает многоточие', () => {
		const line = 'слово '.repeat(30).trim();
		const { title } = buildTaskDraft(withCard(ru, { content: line }));
		expect(title).toBe('слово '.repeat(16).trim() + '…');
		expect(title.length).toBeLessThanOrEqual(101);
	});

	it('слово, закончившееся ровно на сотом символе, остаётся целым', () => {
		const line = 'x'.repeat(49) + ' ' + 'y'.repeat(50) + ' хвост';
		expect(buildTaskDraft(withCard(ru, { content: line })).title).toBe('x'.repeat(49) + ' ' + 'y'.repeat(50) + '…');
	});

	it('одно слово длиннее 100 символов режется жёстко', () => {
		const { title } = buildTaskDraft(withCard(ru, { content: 'x'.repeat(150) }));
		expect(title).toBe('x'.repeat(100) + '…');
	});

	it('жёсткая обрезка не оставляет половинку эмодзи', () => {
		const { title } = buildTaskDraft(withCard(ru, { content: 'x'.repeat(99) + '😀'.repeat(5) }));
		expect(title).toBe('x'.repeat(99) + '…');
	});

	it('карточка-фото без текста называется по доске в обеих локалях', () => {
		expect(buildTaskDraft(withCard(ru, { content: '', imageId: 'img-1' })).title).toBe('Карточка из ретро «Спринт 42»');
		expect(buildTaskDraft(withCard(en, { content: '  \n ', imageId: 'img-1' })).title).toBe('Card from retro “Sprint 42”');
	});
});

describe('buildTaskDraft — описание', () => {
	it('все блоки по порядку через пустую строку (ru)', () => {
		expect(buildTaskDraft(ru).description).toBe(
			[
				'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
				'Из ретро «Спринт 42» · колонка «Не получилось»\nhttps://retro.test/abc123',
				'Автор: Мария · 3 голоса · против: 1',
				'Комментарии:\nПётр: Согласен\nАноним: Только не в релизную неделю'
			].join('\n\n')
		);
	});

	it('все блоки по порядку через пустую строку (en)', () => {
		expect(buildTaskDraft(en).description).toBe(
			[
				'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
				'From retro “Sprint 42” · column “Didn\'t Go Well”\nhttps://retro.test/abc123',
				'Author: Maria · 3 votes · against: 1',
				'Comments:\nPeter: Agreed'
			].join('\n\n')
		);
	});

	it('карточка без текста — описание начинается со строки источника', () => {
		const { description } = buildTaskDraft(withCard(ru, { content: '', imageId: 'img-1' }));
		expect(description.startsWith('Из ретро «Спринт 42» · колонка «Не получилось»\nhttps://retro.test/abc123\n\n')).toBe(true);
	});

	it('без автора остаются только голоса', () => {
		const { description } = buildTaskDraft(withCard(ru, { authorName: null }));
		expect(description).toContain('\n\n3 голоса · против: 1\n\n');
		expect(description).not.toContain('Автор');
	});

	it('голоса — только при лайках, «против» — только при дизлайках, с формами числа', () => {
		expect(buildTaskDraft({ ...ru, likes: 0, dislikes: 2 }).description).toContain('\n\nАвтор: Мария · против: 2\n\n');
		expect(buildTaskDraft({ ...ru, likes: 1, dislikes: 0 }).description).toContain('\n\nАвтор: Мария · 1 голос\n\n');
		expect(buildTaskDraft({ ...ru, likes: 5, dislikes: 0 }).description).toContain('· 5 голосов\n\n');
		expect(buildTaskDraft({ ...en, likes: 1, dislikes: 0 }).description).toContain('\n\nAuthor: Maria · 1 vote\n\n');
	});

	it('без автора и голосов блок пропадает', () => {
		const { description } = buildTaskDraft({ ...withCard(ru, { authorName: null }), likes: 0, dislikes: 0 });
		expect(description).toBe(
			[
				'Релизы по пятницам ломают выходные\nДавайте катить до четверга',
				'Из ретро «Спринт 42» · колонка «Не получилось»\nhttps://retro.test/abc123',
				'Комментарии:\nПётр: Согласен\nАноним: Только не в релизную неделю'
			].join('\n\n')
		);
	});

	it('без комментариев блок пропадает', () => {
		const { description } = buildTaskDraft({ ...ru, comments: [] });
		expect(description.endsWith('https://retro.test/abc123\n\nАвтор: Мария · 3 голоса · против: 1')).toBe(true);
		expect(description).not.toContain('Комментарии');
	});

	it('комментарий без имени — «Аноним», без текста с фото — «Фото»', () => {
		const comments = [
			{ authorName: null, content: 'Плюс', imageId: null },
			{ authorName: 'Олег', content: '', imageId: 'img-2' },
			{ authorName: '  ', content: '  ', imageId: 'img-3' }
		];
		expect(buildTaskDraft({ ...ru, comments }).description).toContain('Комментарии:\nАноним: Плюс\nОлег: Фото\nАноним: Фото');
		expect(buildTaskDraft({ ...en, comments }).description).toContain('Comments:\nAnonymous: Плюс\nОлег: Photo\nAnonymous: Photo');
	});

	it('пустой комментарий без фото пропускается, а без других — нет и заголовка', () => {
		const { description } = buildTaskDraft({ ...ru, comments: [{ authorName: 'Олег', content: '   ', imageId: null }] });
		expect(description).not.toContain('Комментарии');
		expect(description).not.toContain('Олег');
	});

	it('доска-анализ — «Из AI-анализа» без колонки', () => {
		const analysis: DraftInput = {
			...withCard(ru, { authorName: null }),
			board: { title: 'Анализ пространства', slug: 'an1', format: 'analysis' },
			columnTitle: 'Снова плохо'
		};
		const { description } = buildTaskDraft(analysis);
		expect(description).toContain('\n\nИз AI-анализа «Анализ пространства»\nhttps://retro.test/an1\n\n');
		expect(description).not.toContain('колонка');
		expect(buildTaskDraft({ ...analysis, locale: 'en' }).description).toContain('From AI analysis “Анализ пространства”\n');
	});

	it('неизвестная колонка — строка источника без колонки', () => {
		expect(buildTaskDraft({ ...ru, columnTitle: null }).description).toContain('\n\nИз ретро «Спринт 42»\nhttps://retro.test/abc123\n\n');
		expect(buildTaskDraft({ ...en, columnTitle: null }).description).toContain('\n\nFrom retro “Sprint 42”\nhttps://retro.test/abc123\n\n');
	});

	it('завершающий слэш в origin не удваивается', () => {
		expect(buildTaskDraft({ ...ru, origin: 'https://retro.test/' }).description).toContain('\nhttps://retro.test/abc123\n');
	});

	it('текст пользователя подставляется как есть, без шаблонных подстановок', () => {
		const tricky: DraftInput = {
			...withCard(ru, { authorName: 'Ник $1 {name}', content: '' }),
			board: { ...ru.board, title: 'Бюджет $& {column}' }
		};
		const draft = buildTaskDraft(tricky);
		expect(draft.title).toBe('Карточка из ретро «Бюджет $& {column}»');
		expect(draft.description).toContain('Из ретро «Бюджет $& {column}» · колонка «Не получилось»');
		expect(draft.description).toContain('Автор: Ник $1 {name} · 3 голоса');
	});

	it('черновик не длиннее 20 000 символов: не влезшие комментарии отбрасываются с конца', () => {
		const comments = Array.from({ length: 25 }, (_, i) => ({ authorName: `Участник${i}`, content: 'к'.repeat(990), imageId: null }));
		const { description } = buildTaskDraft({ ...ru, comments });
		expect(description.length).toBeLessThanOrEqual(20_000);
		expect(description).toContain('Комментарии:\nУчастник0: ');
		expect(description).not.toContain('Участник24: ');
	});
});
