<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { getSessionId } from '$lib/session.js';
	import type { Vote } from '$lib/types.js';

	let { cardId }: { cardId: string } = $props();

	const sessionId = getSessionId();

	let cardVotes = $derived(boardStore.getCardVotes(cardId));
	let likes = $derived(cardVotes.filter((v: Vote) => v.type === 'like').length);
	let dislikes = $derived(cardVotes.filter((v: Vote) => v.type === 'dislike').length);
	let hasLiked = $derived(cardVotes.some((v: Vote) => v.type === 'like' && v.sessionId === sessionId));
	let hasDisliked = $derived(cardVotes.some((v: Vote) => v.type === 'dislike' && v.sessionId === sessionId));

	let bouncing = $state<'like' | 'dislike' | null>(null);

	function vote(type: 'like' | 'dislike') {
		// Server removes the opposite vote itself and broadcasts the full vote list
		socketStore.toggleVote(cardId, type, sessionId);
		bouncing = type;
		setTimeout(() => (bouncing = null), 300);
	}
</script>

<div class="flex items-center gap-2">
	<button
		onclick={() => vote('like')}
		class="pill max-md:px-4 max-md:py-2 {hasLiked ? 'pill-well' : 'pill-outline'} {bouncing === 'like' ? 'vote-bounce' : ''}"
		aria-pressed={hasLiked}
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="{hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
		</svg>
		{likes}
	</button>
	<button
		onclick={() => vote('dislike')}
		class="pill max-md:px-4 max-md:py-2 {hasDisliked ? 'pill-bad' : 'pill-outline'} {bouncing === 'dislike' ? 'vote-bounce' : ''}"
		aria-pressed={hasDisliked}
	>
		<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="{hasDisliked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
		</svg>
		{dislikes}
	</button>
</div>
