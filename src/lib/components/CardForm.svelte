<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { browser } from '$app/environment';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { column }: { column: ColumnType } = $props();

	let content = $state('');
	let expanded = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	$effect(() => {
		if (expanded && textareaRef) {
			textareaRef.focus();
		}
	});

	function submit() {
		const text = content.trim();
		if (!text || !boardStore.board) return;
		const authorName = browser ? localStorage.getItem('retro_name') || '' : '';
		socketStore.createCard(boardStore.board.id, column, text, authorName || undefined);
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
			bind:this={textareaRef}
			bind:value={content}
			onkeydown={handleKeydown}
			placeholder={t('card.placeholder')}
			maxlength="2000"
			class="w-full resize-none rounded-lg border border-border bg-surface-card p-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
			rows="3"
		></textarea>
		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={() => { expanded = false; content = ''; }}
				class="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
			>
				{t('card.cancel')}
			</button>
			<button
				type="submit"
				disabled={!content.trim()}
				class="rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface transition-opacity disabled:opacity-30"
			>
				{t('card.add')}
			</button>
		</div>
	</form>
{:else}
	<button
		onclick={() => (expanded = true)}
		class="w-full rounded-xl border border-dashed border-border/60 py-2 text-[12px] text-text-muted transition-all hover:border-border-strong hover:text-text-secondary"
	>
		{t('card.addCard')}
	</button>
{/if}
