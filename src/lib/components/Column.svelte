<script lang="ts">
	import CardComponent from './Card.svelte';
	import CardForm from './CardForm.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType, Card } from '$lib/types.js';
	import { COLUMN_CONFIG } from '$lib/types.js';

	let { column }: { column: ColumnType } = $props();

	let config = $derived(COLUMN_CONFIG[column]);

	let columnCards = $derived(boardStore.getColumnCards(column));

	const colorClasses: Record<ColumnType, { header: string; accent: string }> = {
		went_well: {
			header: 'bg-well-bg border-well-border text-well',
			accent: 'border-l-well'
		},
		didnt_go_well: {
			header: 'bg-bad-bg border-bad-border text-bad',
			accent: 'border-l-bad'
		},
		improve: {
			header: 'bg-improve-bg border-improve-border text-improve',
			accent: 'border-l-improve'
		}
	};
</script>

<div class="flex flex-col gap-3">
	<div class="rounded-lg border {colorClasses[column].header} px-3 py-2">
		<h2 class="text-sm font-semibold">
			{config.title}
		</h2>
		<p class="text-xs opacity-70">{columnCards.length} card{columnCards.length !== 1 ? 's' : ''}</p>
	</div>

	<CardForm {column} />

	<div class="flex flex-col gap-2">
		{#each columnCards as card (card.id)}
			<div class="group border-l-2 {colorClasses[column].accent} pl-0 rounded-lg">
				<CardComponent {card} />
			</div>
		{/each}
	</div>
</div>
