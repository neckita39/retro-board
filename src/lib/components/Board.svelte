<script lang="ts">
	import Column from './Column.svelte';
	import BoardSearch from './BoardSearch.svelte';
	import CardForm from './CardForm.svelte';
	import Summary from './Summary.svelte';
	import BitrixTaskModal from './BitrixTaskModal.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { TONE, ANALYSIS_FORMAT } from '$lib/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	let { creatorToken = null }: { creatorToken?: string | null } = $props();

	let columns = $derived(boardStore.columns);

	// Mobile: columns become segment tabs, one column visible at a time
	let active = $state(boardStore.columns[0].id);

	// Формат доски известен только после setState — до этого колонки классические,
	// и active указывал бы на несуществующую колонку: пустой экран на телефоне
	$effect(() => {
		if (!columns.some((c) => c.id === active)) active = columns[0].id;
	});

	// Четыре колонки в один ряд помещаются только на широких экранах
	let gridCols = $derived(columns.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3');

	// Доска-анализ выделяется плоской синей рамкой (семейство improve) вокруг колонок.
	// На телефоне рамки нет: колонки идут во всю ширину и упираются в композер
	let isAnalysis = $derived(boardStore.board?.format === ANALYSIS_FORMAT);
</script>

<BoardSearch />

<!-- Пока идёт слепой ввод, надо объяснить, почему карточки рубашкой -->
{#if boardStore.blind}
	<div class="border-b border-border bg-surface px-4 py-2.5 sm:px-7" data-testid="blind-notice">
		<div class="mx-auto flex max-w-[1360px] items-center gap-2.5 text-[13px] text-text-secondary">
			<svg class="h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
			</svg>
			<span>{t('blind.notice')}</span>
		</div>
	</div>
{/if}

<!-- Mobile segment tabs -->
<div class="flex gap-1.5 px-4 pb-1 pt-3 md:hidden">
	{#each columns as column (column.id)}
		<button
			onclick={() => (active = column.id)}
			aria-pressed={active === column.id}
			class="min-h-11 flex-1 rounded-xl px-1 text-[13px] transition-colors {active === column.id
				? `${TONE[column.tone].tab} border-none font-bold`
				: 'border border-border bg-surface-card font-semibold text-text-secondary'}"
		>
			{txt(column.short)} · {boardStore.getColumnCards(column.id).length}
		</button>
	{/each}
</div>

<!-- Отступы снаружи контейнера 1360, как у шапки и «Итогов»: колонки вровень с брендом -->
<div class="px-4 pb-32 pt-4 sm:px-7 sm:pt-6 md:pb-10">
<div
	class="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-5 {gridCols} {isAnalysis ? 'md:rounded-2xl md:border-2 md:border-improve md:p-5' : ''}"
	data-testid="board-columns"
>
	{#each columns as column (column.id)}
		<div class="min-w-0 {column.id === active ? '' : 'hidden md:block'}">
			<Column column={column.id} />
		</div>
	{/each}
</div>
</div>

<Summary {creatorToken} />

<!-- Mobile composer — pinned to the bottom, adds to the active column -->
<div class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-card px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)] pt-3 md:hidden">
	<CardForm column={active} variant="composer" />
</div>

<!-- Преформа задачи Битрикс24: одна на доску, открывается из карточки и из Итогов -->
<BitrixTaskModal />
