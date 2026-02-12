<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import UserCount from './UserCount.svelte';
	import Timer from './Timer.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { COLUMN_CONFIG } from '$lib/types.js';

	let { showOnline = false }: { showOnline?: boolean } = $props();

	function exportBoard() {
		if (!boardStore.board) return;

		const columns: Record<string, Array<{
			content: string;
			authorName: string | null;
			likes: number;
			comments: Array<{ content: string; authorName: string | null }>;
		}>> = {};

		for (const [colType, config] of Object.entries(COLUMN_CONFIG)) {
			columns[colType] = boardStore.getColumnCards(colType).map((card) => ({
				content: card.content,
				authorName: card.authorName,
				likes: boardStore.getCardLikes(card.id),
				comments: boardStore.getCardComments(card.id).map((c) => ({
					content: c.content,
					authorName: c.authorName
				}))
			}));
		}

		const exported = {
			board: {
				title: boardStore.board.title,
				slug: boardStore.board.slug,
				createdAt: boardStore.board.createdAt
			},
			columns
		};

		const filename = `board-${boardStore.board.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
		const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<header class="border-b border-border bg-surface-card px-4 py-3 transition-colors sm:px-6">
	<div class="mx-auto flex max-w-7xl items-center justify-between">
		<div class="flex items-center gap-3">
			<a href="/" class="text-lg font-bold tracking-tight text-text-primary">
				Retro Board
			</a>
			{#if boardStore.board}
				<span class="text-text-muted">/</span>
				<span class="text-sm font-medium text-text-secondary">{boardStore.board.title}</span>
			{/if}
		</div>
		<div class="flex items-center gap-3">
			{#if showOnline}
				<UserCount />
			{/if}
			{#if boardStore.board}
				<Timer />
				<button
					onclick={exportBoard}
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-hover"
					aria-label="Export board"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="7 10 12 15 17 10"/>
						<line x1="12" y1="15" x2="12" y2="3"/>
					</svg>
				</button>
			{/if}
			<ThemeToggle />
		</div>
	</div>
</header>
