<script lang="ts">
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import type { Card } from '$lib/types.js';

	let { card }: { card: Card } = $props();

	let editing = $state(false);
	let editContent = $state('');

	function startEdit() {
		editContent = card.content;
		editing = true;
	}

	function saveEdit() {
		const text = editContent.trim();
		if (text && text !== card.content) {
			socketStore.updateCard(card.id, text);
		}
		editing = false;
	}

	function cancelEdit() {
		editing = false;
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') cancelEdit();
	}

	function deleteCard() {
		socketStore.deleteCard(card.id);
	}
</script>

<div class="card-enter overflow-hidden rounded-lg border border-border bg-surface-card p-3 shadow-sm transition-colors hover:shadow-md">
	<div class="flex items-start justify-between gap-2">
		{#if editing}
			<textarea
				bind:value={editContent}
				onkeydown={handleEditKeydown}
				onblur={saveEdit}
				class="flex-1 resize-none rounded border border-border bg-surface p-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
				rows="2"
			></textarea>
		{:else}
			<p class="flex-1 text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words">{card.content}</p>
			<div class="flex shrink-0 gap-0.5">
				<button
					onclick={startEdit}
					class="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-surface-hover hover:text-text-secondary group-hover:opacity-100"
					aria-label="Edit"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button
					onclick={deleteCard}
					class="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 group-hover:opacity-100"
					aria-label="Delete"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	{#if card.authorName}
		<p class="mt-1 text-xs text-text-muted">— {card.authorName}</p>
	{/if}

	<div class="mt-2 flex items-center justify-between">
		<VoteButtons cardId={card.id} />
	</div>

	<CommentList cardId={card.id} />
</div>
