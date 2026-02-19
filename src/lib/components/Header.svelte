<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import UserCount from './UserCount.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';

	let { showOnline = false }: { showOnline?: boolean } = $props();

	let exportOpen = $state(false);

	function closeExport() {
		exportOpen = false;
	}

	function handleExport(format: 'json' | 'md') {
		if (!boardStore.board) return;
		const url = `/${boardStore.board.slug}/export${format === 'md' ? '?format=md' : ''}`;
		const a = document.createElement('a');
		a.href = url;
		a.download = '';
		a.click();
		exportOpen = false;
	}
</script>

<svelte:window onclick={() => exportOpen && closeExport()} />

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
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); exportOpen = !exportOpen; }}
						class="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-hover"
						aria-label="Export board"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
							<polyline points="7 10 12 15 17 10"/>
							<line x1="12" y1="15" x2="12" y2="3"/>
						</svg>
					</button>
					{#if exportOpen}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							onclick={(e) => e.stopPropagation()}
							class="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-border bg-surface-card py-1 shadow-lg"
						>
							<button
								onclick={() => handleExport('json')}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-hover"
							>
								<span class="font-mono text-xs text-text-muted">{'{}'}</span>
								JSON
							</button>
							<button
								onclick={() => handleExport('md')}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-hover"
							>
								<span class="font-mono text-xs text-text-muted">MD</span>
								Markdown
							</button>
						</div>
					{/if}
				</div>
			{/if}
			<ThemeToggle />
		</div>
	</div>
</header>
