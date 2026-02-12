<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import UserCount from './UserCount.svelte';
	import Timer from './Timer.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';

	let { showOnline = false }: { showOnline?: boolean } = $props();
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
			{/if}
			<ThemeToggle />
		</div>
	</div>
</header>
