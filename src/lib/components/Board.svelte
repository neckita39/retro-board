<script lang="ts">
	import Column from './Column.svelte';
	import CardForm from './CardForm.svelte';
	import Summary from './Summary.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	const columns: ColumnType[] = ['went_well', 'didnt_go_well', 'improve'];

	// Mobile: columns become segment tabs, one column visible at a time
	let active = $state<ColumnType>('went_well');

	const activeTab: Record<ColumnType, string> = {
		went_well: 'bg-well text-white',
		didnt_go_well: 'bg-bad text-white',
		improve: 'bg-improve text-white'
	};
</script>

<!-- Mobile segment tabs -->
<div class="flex gap-1.5 px-4 pb-1 pt-3 md:hidden">
	{#each columns as column (column)}
		<button
			onclick={() => (active = column)}
			aria-pressed={active === column}
			class="min-h-11 flex-1 rounded-xl px-1 text-[13px] transition-colors {active === column
				? `${activeTab[column]} border-none font-bold`
				: 'border border-border bg-surface-card font-semibold text-text-secondary'}"
		>
			{t(`column.short.${column}`)} · {boardStore.getColumnCards(column).length}
		</button>
	{/each}
</div>

<div class="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-5 p-4 pb-32 sm:p-6 md:grid-cols-3 md:pb-10 lg:px-7">
	{#each columns as column (column)}
		<div class="min-w-0 {column === active ? '' : 'hidden md:block'}">
			<Column {column} />
		</div>
	{/each}
</div>

<Summary />

<!-- Mobile composer — pinned to the bottom, adds to the active column -->
<div class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-card px-4 pb-[max(env(safe-area-inset-bottom),0.875rem)] pt-3 md:hidden">
	<CardForm column={active} variant="composer" />
</div>
