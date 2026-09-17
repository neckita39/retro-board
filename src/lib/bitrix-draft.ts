// Черновик задачи Битрикс24 из карточки: название и описание для преформы
// (спека, Секция 4 «Преформа», заметки макета 19–20). Чистый модуль без сторов
// и t(): локаль приходит аргументом, поэтому тест гоняет обе локали, а модалка
// считает черновик один раз при открытии.
import { translate, type Locale } from '$lib/i18n/index.js';
import { ANALYSIS_FORMAT } from '$lib/formats.js';

export interface DraftInput {
	card: { content: string; authorName: string | null; imageId: string | null };
	board: { title: string; slug: string; format: string };
	/** Название колонки, уже локализованное вызывающим через txt(); null — колонка неизвестна */
	columnTitle: string | null;
	/** Комментарии карточки в порядке показа */
	comments: { authorName: string | null; content: string; imageId: string | null }[];
	likes: number;
	dislikes: number;
	/** page.url.origin */
	origin: string;
	locale: Locale;
}

const TITLE_MAX = 100;
/** Потолок описания в parseTaskForm: длиннее — 422 invalid */
const DESCRIPTION_MAX = 20_000;

/**
 * Подставляет пользовательский текст в шаблон словаря за один проход.
 * Не через params у translate(): его replaceAll со строкой понимает `$&` и `$'`,
 * а `{column}` в названии доски подставился бы второй раз.
 */
function fill(locale: Locale, key: string, params: Record<string, string>): string {
	return translate(locale, key).replace(/\{(\w+)\}/g, (placeholder, name: string) => params[name] ?? placeholder);
}

function truncateTitle(line: string): string {
	if (line.length <= TITLE_MAX) return line;
	const head = line.slice(0, TITLE_MAX);
	// Сотый символ закончил слово — оно остаётся целым
	if (/\s/.test(line[TITLE_MAX])) return head.trimEnd() + '…';
	const lastSpace = head.search(/\s\S*$/);
	if (lastSpace > 0) return head.slice(0, lastSpace).trimEnd() + '…';
	// Одно слово длиннее 100 символов (например, ссылка): жёсткий срез без половинки эмодзи
	const last = head.charCodeAt(head.length - 1);
	return (last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head) + '…';
}

function sourceLine({ board, columnTitle, locale }: DraftInput): string {
	if (board.format === ANALYSIS_FORMAT) return fill(locale, 'bitrix.draft.fromAnalysis', { board: board.title });
	if (columnTitle) return fill(locale, 'bitrix.draft.fromRetro', { board: board.title, column: columnTitle });
	return fill(locale, 'bitrix.draft.fromRetroNoColumn', { board: board.title });
}

function authorLine({ card, likes, dislikes, locale }: DraftInput): string {
	const parts: string[] = [];
	const name = card.authorName?.trim();
	if (name) parts.push(fill(locale, 'bitrix.draft.author', { name }));
	if (likes > 0) parts.push(translate(locale, 'bitrix.draft.votes', { n: likes }));
	if (dislikes > 0) parts.push(translate(locale, 'bitrix.draft.against', { n: dislikes }));
	return parts.join(' · ');
}

function commentLines({ comments, locale }: DraftInput): string[] {
	const lines: string[] = [];
	for (const comment of comments) {
		const name = comment.authorName?.trim() || translate(locale, 'bitrix.draft.anonymous');
		const text = comment.content.trim() || (comment.imageId ? translate(locale, 'summary.photo') : '');
		if (text) lines.push(`${name}: ${text}`);
	}
	return lines;
}

export function buildTaskDraft(input: DraftInput): { title: string; description: string } {
	const { card, board, locale } = input;
	const text = card.content.trim();
	const title = text
		? truncateTitle(text.split('\n')[0].trim())
		: fill(locale, 'bitrix.draft.photoCard', { board: board.title });

	const blocks: string[] = [];
	if (text) blocks.push(text);
	blocks.push(`${sourceLine(input)}\n${input.origin.replace(/\/+$/, '')}/${board.slug}`);
	const author = authorLine(input);
	if (author) blocks.push(author);
	let description = blocks.join('\n\n');

	const lines = commentLines(input);
	let commentsBlock = translate(locale, 'bitrix.draft.comments');
	let added = 0;
	for (const line of lines) {
		// Карточка ≤ 2000 символов, поэтому переполнить потолок могут только комментарии
		if (description.length + 2 + commentsBlock.length + 1 + line.length > DESCRIPTION_MAX) break;
		commentsBlock += `\n${line}`;
		added++;
	}
	if (added > 0) description += `\n\n${commentsBlock}`;

	return { title, description };
}
