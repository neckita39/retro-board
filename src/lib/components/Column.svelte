<script lang="ts">
	import CardComponent from './Card.svelte';
	import CardForm from './CardForm.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType, Card } from '$lib/types.js';
	import { COLUMN_CONFIG } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { column }: { column: ColumnType } = $props();

	let config = $derived(COLUMN_CONFIG[column]);

	let columnCards = $derived(boardStore.getColumnCards(column));

	const dotColor: Record<ColumnType, string> = {
		went_well: 'bg-well',
		didnt_go_well: 'bg-bad',
		improve: 'bg-improve'
	};
</script>

<div class="flex flex-col gap-2">
	<!-- Column header — dot indicator style -->
	<div class="flex items-center gap-2 rounded-[10px] border border-border bg-surface-hover px-3 py-2.5 transition-colors">
		<div class="h-2 w-2 rounded-full {dotColor[column]}"></div>
		<h2 class="text-[13px] font-semibold text-text-primary">
			{t(`column.${column}`)}
		</h2>
		<span class="ml-auto text-[11px] tabular-nums text-text-muted">{columnCards.length}</span>
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
