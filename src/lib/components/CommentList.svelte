<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import CommentForm from './CommentForm.svelte';
	import type { Comment } from '$lib/types.js';

	let { cardId }: { cardId: string } = $props();

	let expanded = $state(false);
	let cardComments = $derived(
		boardStore.getCardComments(cardId).sort(
			(a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		)
	);
</script>

<div class="mt-2 border-t border-border pt-2">
	<button
		onclick={() => (expanded = !expanded)}
		class="text-xs text-text-muted hover:text-text-secondary transition-colors"
	>
		{cardComments.length} comment{cardComments.length !== 1 ? 's' : ''}
		{expanded ? '▴' : '▾'}
	</button>

	{#if expanded}
		<div class="mt-2 space-y-2">
			{#each cardComments as comment (comment.id)}
				<div class="rounded-md bg-surface px-2.5 py-1.5 text-xs">
					{#if comment.authorName}
						<span class="font-medium text-text-secondary">{comment.authorName}</span>
						<span class="text-text-muted mx-1">&middot;</span>
					{/if}
					<span class="text-text-primary">{comment.content}</span>
				</div>
			{/each}
			<CommentForm {cardId} />
		</div>
	{/if}
</div>
