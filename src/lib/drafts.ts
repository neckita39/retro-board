// Черновик недописанной карточки. Человек набирает мысль, случайно обновляет
// вкладку или уходит на другую доску — текст не должен пропадать.
//
// Храним в localStorage и только в нём: черновик виден лишь автору, на сервер
// не уходит и другим участникам доски не показывается, пока карточка не создана.
// Каждое обращение обёрнуто в try/catch: в приватном окне и при запрещённых
// site data любой доступ к localStorage бросает, и форма обязана продолжать работать.

const PREFIX = 'retro_draft_';

/** Ключ черновика: своя запись на каждую колонку каждой доски */
export function draftKey(boardSlug: string, column: string): string {
	return `${PREFIX}${boardSlug}:${column}`;
}

export function readDraft(key: string): string {
	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
}

/** Пустой черновик не храним — иначе в localStorage копятся пустые ключи */
export function writeDraft(key: string, text: string): void {
	try {
		if (text.trim()) localStorage.setItem(key, text);
		else localStorage.removeItem(key);
	} catch {
		// приватное окно: черновик просто не переживёт перезагрузку
	}
}

export function clearDraft(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// см. writeDraft
	}
}
