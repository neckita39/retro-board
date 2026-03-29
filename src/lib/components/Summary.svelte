<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

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
</script>

<div class="border-t border-border bg-surface-card/50 p-4 sm:p-6 lg:p-8">
	<h2 class="font-heading mb-4 text-lg font-bold text-text-primary">{t('summary.title')}</h2>

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
					<div class="mt-2 first:mt-0">
						<span class="badge-sm {tagColors[card.columnType]}">
							{t(`column.${card.columnType}`)}
						</span>
					</div>
				{/if}
				<div class="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-card py-2 px-2.5 transition-all duration-300 hover:translate-x-0.5 hover:border-border-strong">
					<span class="shrink-0 min-w-6 text-center text-[11px] font-semibold tabular-nums text-text-muted">
						{boardStore.getCardLikes(card.id)} &uarr;
					</span>
					<p class="flex-1 text-[13px] text-text-primary">{card.content}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
