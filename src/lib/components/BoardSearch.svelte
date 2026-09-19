<script lang="ts">
	import { searchStore } from '$lib/stores/search.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { cardMatches } from '$lib/search.js';
	import { t } from '$lib/i18n/index.js';

	let inputRef = $state<HTMLInputElement | null>(null);

	// Полоска открылась — курсор сразу в поле, иначе придётся целиться мышью
	$effect(() => {
		if (searchStore.open && inputRef) inputRef.focus();
	});

	let found = $derived(
		searchStore.active
			? boardStore.cards.filter((c) => cardMatches(c, boardStore.getCardComments(c.id), searchStore.query)).length
			: 0
	);

	// «/» — открыть поиск, как в почте и трекерах. Не перехватываем, пока человек
	// печатает: иначе слэш не набрать ни в карточке, ни в комментарии
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
		const el = e.target as HTMLElement | null;
		const tag = el?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
		e.preventDefault();
		searchStore.show();
		inputRef?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			searchStore.close();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- Полоска поиска под шапкой: в самой шапке места нет, а поле должно быть широким.
     Карточки не прячем, а гасим — на ретро важно видеть, в какой колонке нашлось -->
{#if searchStore.open}
	<div
		class="sticky top-[57px] z-30 border-b border-border bg-surface-card px-4 py-2.5 sm:px-7"
		style="animation: fadeUp 0.2s cubic-bezier(0.25, 1, 0.5, 1) both;"
		data-testid="board-search"
	>
		<div class="mx-auto flex max-w-[1360px] items-center gap-2.5">
			<svg class="h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<input
				bind:this={inputRef}
				bind:value={searchStore.query}
				onkeydown={onKeydown}
				type="text"
				maxlength="100"
				placeholder={t('search.placeholder')}
				aria-label={t('search.placeholder')}
				class="h-8 min-w-0 flex-1 border-none bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
			/>
			{#if searchStore.active}
				<span class="shrink-0 text-[13px] tabular-nums text-text-secondary" data-testid="search-count">
					{found > 0 ? t('search.found', { n: found }) : t('search.none')}
				</span>
			{/if}
			<button
				onclick={() => searchStore.close()}
				class="btn-icon btn-icon-sm shrink-0"
				aria-label={t('search.close')}
				title={t('search.close')}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
	</div>
{/if}
