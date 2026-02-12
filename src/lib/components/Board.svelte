<script lang="ts">
	import Column from './Column.svelte';
	import Summary from './Summary.svelte';
	import type { ColumnType } from '$lib/types.js';

	const columns: ColumnType[] = ['went_well', 'didnt_go_well', 'improve'];
</script>

<div class="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:p-8 md:grid-cols-3">
	{#each columns as column (column)}
		<div class="min-w-0">
			<Column {column} />
		</div>
	{/each}
</div>

<Summary />
