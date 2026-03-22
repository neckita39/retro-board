<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import CommentForm from './CommentForm.svelte';
	import type { Comment } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

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
		class="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
		{t('comment.count', { n: cardComments.length })}
	</button>

	{#if expanded}
		<div class="mt-2 space-y-2">
			{#each cardComments as comment (comment.id)}
				<div class="rounded-md bg-surface px-2.5 py-1.5 text-xs">
					{#if comment.authorName}
						<span class="font-medium text-text-secondary">{comment.authorName}</span>
						<span class="text-text-muted mx-1">&middot;</span>
					{/if}
					{#if comment.content}
						<span class="text-text-primary">{comment.content}</span>
					{/if}
					{#if comment.imageId}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<img
							src="/api/image/{comment.imageId}"
							alt=""
							class="mt-1 max-h-32 cursor-zoom-in rounded border border-border object-cover transition-transform hover:scale-[1.02]"
							onclick={() => lightboxStore.open(comment.imageId!)}
						/>
					{/if}
				</div>
			{/each}
			<CommentForm {cardId} />
		</div>
	{/if}
</div>
