<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import UserCount from './UserCount.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { socketStore } from '$lib/stores/socket.svelte.js';

	let { showOnline = false }: { showOnline?: boolean } = $props();

	function deleteBoard() {
		if (!boardStore.board) return;
		if (!confirm('Delete this board? This cannot be undone.')) return;
		socketStore.deleteBoard(boardStore.board.id);
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
				<a
					href="/{boardStore.board.slug}/export"
					download
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-hover"
					aria-label="Export board"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="7 10 12 15 17 10"/>
						<line x1="12" y1="15" x2="12" y2="3"/>
					</svg>
				</a>
				<button
					onclick={deleteBoard}
					class="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
					aria-label="Delete board"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"/>
						<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
						<path d="M10 11v6"/>
						<path d="M14 11v6"/>
						<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
					</svg>
				</button>
			{/if}
			<ThemeToggle />
		</div>
	</div>
</header>
