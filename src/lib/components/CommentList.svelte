<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import CommentForm from './CommentForm.svelte';
	import type { Comment } from '$lib/types.js';

	let { cardId, expanded = false }: { cardId: string; expanded?: boolean } = $props();

	let cardComments = $derived(
		boardStore.getCardComments(cardId).sort(
			(a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		)
	);
</script>

<div class="collapsible {expanded ? 'open' : ''}">
	<div>
		<div class="mt-3 space-y-2 border-t border-border pt-3">
			{#each cardComments as comment (comment.id)}
				<div class="rounded-[10px] bg-surface px-3 py-2 text-[13px] leading-relaxed">
					{#if comment.authorName}
						<span class="font-semibold text-text-secondary">{comment.authorName}</span>
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
							class="mt-1 max-h-32 cursor-zoom-in rounded-lg border border-border object-contain transition-transform hover:scale-[1.02]"
							onclick={() => lightboxStore.open(comment.imageId!)}
						/>
					{/if}
				</div>
			{/each}
			<CommentForm {cardId} />
		</div>
	</div>
</div>
