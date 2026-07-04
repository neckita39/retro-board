<script lang="ts">
	import CardComponent from './Card.svelte';
	import CardForm from './CardForm.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { column }: { column: ColumnType } = $props();

	let sortBy = $state<'newest' | 'votes'>('newest');

	let columnCards = $derived(boardStore.getColumnCards(column, sortBy));

	const borderColor: Record<ColumnType, string> = {
		went_well: 'border-well',
		didnt_go_well: 'border-bad',
		improve: 'border-improve'
	};

	const countColor: Record<ColumnType, string> = {
		went_well: 'text-well',
		didnt_go_well: 'text-bad',
		improve: 'text-improve'
	};
</script>

<div data-testid="column" class="flex flex-col gap-3">
	<!-- Column header — title underlined with the column color -->
	<div class="flex items-baseline gap-2.5 border-b-[3px] pb-2.5 {borderColor[column]}">
		<h2 class="font-heading text-lg font-bold text-text-primary lg:text-[21px]">
			{t(`column.${column}`)}
		</h2>
		<span class="text-sm font-semibold tabular-nums {countColor[column]}">{columnCards.length}</span>
		<button
			onclick={() => (sortBy = sortBy === 'newest' ? 'votes' : 'newest')}
			class="btn-icon btn-icon-sm ml-auto self-center {sortBy === 'votes' ? 'text-accent' : ''}"
			aria-label={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			title={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			aria-pressed={sortBy === 'votes'}
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
		</button>
	</div>

	<!-- Add card — always visible on top; the mobile composer lives at the bottom of the screen -->
	<div class="hidden md:block">
		<CardForm {column} />
	</div>

	<div class="flex flex-col gap-2.5">
		{#each columnCards as card, i (card.id)}
			<div style="animation: cardEnter 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) {i * 0.05}s both;">
				<CardComponent {card} />
			</div>
		{/each}
	</div>
</div>
