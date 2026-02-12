<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { COLUMN_CONFIG } from '$lib/types.js';
	import type { ColumnType } from '$lib/types.js';

	let summaryCards = $derived(boardStore.getSummaryCards());

	const accentColors: Record<ColumnType, string> = {
		went_well: 'border-l-well',
		didnt_go_well: 'border-l-bad',
		improve: 'border-l-improve'
	};

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well',
		didnt_go_well: 'bg-bad-bg text-bad',
		improve: 'bg-improve-bg text-improve'
	};

	let prevColumn = $state<string>('');
</script>

<div class="border-t border-border bg-surface-card/50 p-4 sm:p-6 lg:p-8">
	<h2 class="mb-4 text-lg font-bold text-text-primary">Summary</h2>

	{#if summaryCards.length === 0}
		<p class="text-sm text-text-muted">No cards yet. Add some cards to see the summary.</p>
	{:else}
		<div class="flex flex-col gap-2">
			{#each summaryCards as card, i (card.id)}
				{@const showHeader = card.columnType !== (i > 0 ? summaryCards[i - 1].columnType : '')}
				{#if showHeader}
					<div class="mt-2 first:mt-0">
						<span class="inline-block rounded-md px-2 py-0.5 text-xs font-semibold {tagColors[card.columnType]}">
							{COLUMN_CONFIG[card.columnType].title}
						</span>
					</div>
				{/if}
				<div class="flex items-center gap-3 rounded-lg border border-border bg-surface-card p-2.5 border-l-2 {accentColors[card.columnType]}">
					<span class="shrink-0 min-w-6 text-center text-xs font-medium text-text-muted">
						{boardStore.getCardLikes(card.id)} &uarr;
					</span>
					<p class="flex-1 text-sm text-text-primary">{card.content}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
