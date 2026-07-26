<script lang="ts">
	import SummaryRow from './SummaryRow.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { focusIndex, nextCardId, prevCardId } from '$lib/focus.js';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { creatorToken = null }: { creatorToken?: string | null } = $props();

	let summaryCards = $derived(boardStore.getSummaryCards());

	// «Итоги» — это и есть повестка обсуждения: колонки по порядку,
	// внутри колонки по лайкам. Фокус едет по ней сверху вниз.
	let focusActive = $derived(socketStore.focusCardId !== null);
	let canControl = $derived(boardStore.isCreator && focusActive);
	let focusedIdx = $derived(focusIndex(summaryCards, socketStore.focusCardId));
	// Обсуждаемую карточку могли удалить прямо во время обсуждения. Тогда гасить
	// список нельзя — подсвечивать стало нечего, и все увидели бы серую простыню.
	let focusVisible = $derived(focusActive && focusedIdx !== -1);
	let focusedColumn = $derived(summaryCards[focusedIdx]?.columnType ?? null);
	let nextId = $derived(
		nextCardId(summaryCards, socketStore.focusCardId, socketStore.focusDiscussed)
	);
	let prevId = $derived(prevCardId(summaryCards, socketStore.focusCardId));

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well-strong',
		didnt_go_well: 'bg-bad-bg text-bad-strong',
		improve: 'bg-improve-bg text-improve-strong'
	};

	function start() {
		const first = summaryCards[0];
		if (first) socketStore.startFocus(first.id, creatorToken);
	}

	function stop() {
		socketStore.stopFocus(creatorToken);
	}

	function jump(cardId: string) {
		socketStore.setFocus(cardId, creatorToken);
	}
</script>

<div class="border-t border-border bg-surface-card/50 p-4 pb-32 sm:p-6 md:pb-10 lg:px-7">
	<div class="mx-auto max-w-[1360px]">
	<div class="mb-4 flex items-center gap-3">
		<h2 class="font-heading text-lg font-bold text-text-primary">{t('summary.title')}</h2>
		{#if boardStore.isCreator}
			{#if focusActive}
				<button onclick={stop} class="btn btn-secondary btn-sm ml-auto">
					{t('focus.stop')}
				</button>
			{:else}
				<button
					onclick={start}
					disabled={summaryCards.length === 0}
					title={summaryCards.length === 0 ? t('focus.disabled') : undefined}
					class="btn btn-primary btn-sm ml-auto disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
					{t('focus.start')}
				</button>
			{/if}
		{/if}
	</div>

	{#if summaryCards.length === 0}
		<div class="flex flex-col items-center gap-2 py-6 text-center">
			<svg class="h-8 w-8 text-text-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
			<p class="text-[13px] text-text-muted">{t('summary.empty')}</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each summaryCards as card, i (card.id)}
				{@const showHeader = card.columnType !== (i > 0 ? summaryCards[i - 1].columnType : '')}
				{#if showHeader}
					<div class="mt-2 transition-opacity duration-300 first:mt-0 {focusVisible && card.columnType !== focusedColumn ? 'opacity-45' : 'opacity-100'}">
						<span class="badge-sm {tagColors[card.columnType]}">
							{t(`column.${card.columnType}`)}
						</span>
					</div>
				{/if}
				<SummaryRow
					{card}
					focused={card.id === socketStore.focusCardId}
					discussed={socketStore.focusDiscussed.includes(card.id)}
					dimmed={focusVisible && card.id !== socketStore.focusCardId}
					{canControl}
					position={{ n: i + 1, total: summaryCards.length }}
					hasNext={nextId !== null}
					hasPrev={prevId !== null}
					onJump={() => jump(card.id)}
					onNext={() => nextId && jump(nextId)}
					onPrev={() => prevId && jump(prevId)}
				/>
			{/each}
		</div>
	{/if}
	</div>
</div>
