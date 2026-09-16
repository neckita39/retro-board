// use:truncatedTitle={text} — подсказка с полным текстом только когда он
// обрезан (truncate). Влезает целиком — title не ставим, чтобы не дублировать
// видимое. Пересчёт при изменении ширины и после загрузки шрифтов: до неё
// метрики другие.
export function isOverflowing(el: { scrollWidth: number; clientWidth: number }): boolean {
	return el.scrollWidth > el.clientWidth;
}

export function truncatedTitle(node: HTMLElement, text: string) {
	let current = text;

	const update = () => {
		if (isOverflowing(node)) node.title = current;
		else node.removeAttribute('title');
	};

	const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
	observer?.observe(node);
	update();
	if (typeof document !== 'undefined' && document.fonts?.ready) {
		void document.fonts.ready.then(update);
	}

	return {
		update(next: string) {
			current = next;
			// Текст в DOM обновится после этого вызова — меряем на следующем кадре
			requestAnimationFrame(update);
		},
		destroy() {
			observer?.disconnect();
		}
	};
}
