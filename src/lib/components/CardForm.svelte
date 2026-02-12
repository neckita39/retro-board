<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { ColumnType } from '$lib/types.js';

	let { column }: { column: ColumnType } = $props();

	let content = $state('');
	let expanded = $state(false);

	function submit() {
		const text = content.trim();
		if (!text || !boardStore.board) return;
		socketStore.createCard(boardStore.board.id, column, text);
		content = '';
		expanded = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
		if (e.key === 'Escape') {
			expanded = false;
			content = '';
		}
	}
</script>

{#if expanded}
	<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-2">
		<textarea
			bind:value={content}
			onkeydown={handleKeydown}
			placeholder="What's on your mind?"
			class="w-full resize-none rounded-lg border border-border bg-surface-card p-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
			rows="3"
		></textarea>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={() => { expanded = false; content = ''; }}
				class="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={!content.trim()}
				class="rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface transition-opacity disabled:opacity-30"
			>
				Add
			</button>
		</div>
	</form>
{:else}
	<button
		onclick={() => (expanded = true)}
		class="w-full rounded-lg border border-dashed border-border p-2.5 text-sm text-text-muted transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-text-secondary"
	>
		+ Add a card
	</button>
{/if}
