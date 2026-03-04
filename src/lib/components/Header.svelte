<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import UserCount from './UserCount.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { showOnline = false, adminLink = null, spaceName = null, spaceSlug = null }: { showOnline?: boolean; adminLink?: string | null; spaceName?: string | null; spaceSlug?: string | null } = $props();

	let deleteConfirming = $state(false);

	async function deleteBoard() {
		if (!boardStore.board) return;
		deleteConfirming = false;
		const res = await fetch(`/${boardStore.board.slug}`, { method: 'DELETE' });
		if (res.ok) window.location.href = '/';
	}

	let exportOpen = $state(false);
	let copyOpen = $state(false);
	let copied = $state(false);

	function closeDropdowns() {
		exportOpen = false;
		copyOpen = false;
		deleteConfirming = false;
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

	async function copyText(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		copyOpen = false;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:window onclick={() => (exportOpen || copyOpen) && closeDropdowns()} />

<header class="border-b border-border bg-surface-card px-4 py-3 transition-colors sm:px-6">
	<div class="mx-auto flex max-w-7xl items-center justify-between">
		<div class="flex min-w-0 items-center gap-3">
			<a href="/" class="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-text-primary">
				<img src="/logo.png" alt="" width="24" height="24" class="dark:invert" />
				<span class="hidden sm:inline">{t('header.brand')}</span>
			</a>
			{#if spaceName}
				<span class="text-text-muted">/</span>
				<a href="/spaces/{spaceSlug}" class="min-w-0 truncate text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">{spaceName}</a>
			{/if}
			{#if boardStore.board}
				<span class="text-text-muted">/</span>
				<span class="min-w-0 truncate text-sm font-medium text-text-secondary">{boardStore.board.title}</span>
			{/if}
		</div>
		<div class="flex items-center gap-3">
			{#if showOnline}
				<UserCount />
			{/if}
			{#if boardStore.board}
				<!-- Copy dropdown -->
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); copyOpen = !copyOpen; exportOpen = false; }}
						class="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-hover {copied ? 'text-emerald-500' : ''}"
						aria-label={t('copy.title')}
						title={copied ? t('copy.copied') : t('copy.title')}
					>
						{#if copied}
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
								<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
							</svg>
						{/if}
					</button>
					{#if copyOpen}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							onclick={(e) => e.stopPropagation()}
							class="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-border bg-surface-card py-1 shadow-lg"
						>
							<button
								onclick={() => copyText(window.location.href)}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-hover"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
								{t('copy.link')}
							</button>
							<button
								onclick={() => copyText(boardStore.board?.slug ?? '')}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-hover"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-text-muted">
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
									<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
								</svg>
								{t('copy.code')}
							</button>
							{#if adminLink}
								<hr class="my-1 border-border" />
								<button
									onclick={() => copyText(adminLink!)}
									class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-600 transition-colors hover:bg-surface-hover dark:text-amber-400"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
										<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
									</svg>
									{t('copy.admin')}
								</button>
							{/if}
						</div>
					{/if}
				</div>
				<!-- Export dropdown -->
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); exportOpen = !exportOpen; copyOpen = false; }}
						class="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-hover"
						aria-label={t('export.title')}
						title={t('export.title')}
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
								{t('export.json')}
							</button>
							<button
								onclick={() => handleExport('md')}
								class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-hover"
							>
								<span class="font-mono text-xs text-text-muted">MD</span>
								{t('export.markdown')}
							</button>
						</div>
					{/if}
				</div>
			{/if}
			{#if boardStore.board && boardStore.isCreator}
				<!-- Delete board -->
				{#if deleteConfirming}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
						<span class="text-xs text-text-secondary">{t('board.delete.confirm')}</span>
						<button
							onclick={deleteBoard}
							class="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
						>
							{t('board.delete')}
						</button>
						<button
							onclick={() => (deleteConfirming = false)}
							class="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
						>
							{t('card.cancel')}
						</button>
					</div>
				{:else}
					<button
						onclick={(e) => { e.stopPropagation(); deleteConfirming = true; }}
						class="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
						aria-label={t('board.delete')}
						title={t('board.delete')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="3 6 5 6 21 6"/>
							<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
							<path d="M10 11v6"/>
							<path d="M14 11v6"/>
							<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
						</svg>
					</button>
				{/if}
			{/if}
			<LocaleToggle />
			<ThemeToggle />
		</div>
	</div>
</header>
