<script lang="ts">
	import CardComponent from './Card.svelte';
	import CardForm from './CardForm.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType, Card } from '$lib/types.js';
	import { COLUMN_CONFIG } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { column }: { column: ColumnType } = $props();

	let config = $derived(COLUMN_CONFIG[column]);

	let sortBy = $state<'newest' | 'votes'>('newest');

	let columnCards = $derived(boardStore.getColumnCards(column, sortBy));

	const dotColor: Record<ColumnType, string> = {
		went_well: 'bg-well',
		didnt_go_well: 'bg-bad',
		improve: 'bg-improve'
	};

	const columnBg: Record<ColumnType, string> = {
		went_well: 'bg-well-bg/50',
		didnt_go_well: 'bg-bad-bg/50',
		improve: 'bg-improve-bg/50'
	};
</script>

<div class="flex flex-col gap-2 rounded-2xl p-2.5 {columnBg[column]} transition-colors">
	<!-- Column header — dot indicator style -->
	<div class="flex items-center gap-2 rounded-[10px] border border-border bg-surface-hover px-3 py-2.5 transition-colors">
		<div class="h-2 w-2 rounded-full {dotColor[column]}"></div>
		<h2 class="text-[13px] font-semibold text-text-primary">
			{t(`column.${column}`)}
		</h2>
		<button
			onclick={() => (sortBy = sortBy === 'newest' ? 'votes' : 'newest')}
			class="btn-icon btn-icon-sm ml-auto {sortBy === 'votes' ? 'text-accent' : ''}"
			aria-label={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			title={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			aria-pressed={sortBy === 'votes'}
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
		</button>
		<span class="text-[11px] tabular-nums text-text-muted">{columnCards.length}</span>
	</div>

	<CardForm {column} />

	<div class="flex flex-col gap-2">
		{#each columnCards as card, i (card.id)}
			<div class="group" style="animation: cardEnter 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) {i * 0.05}s both;">
				<CardComponent {card} />
			</div>
		{/each}
	</div>
</div>
