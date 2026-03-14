<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import UserCount from './UserCount.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { showOnline = false, adminLink = null, spaceName = null, spaceSlug = null }: { showOnline?: boolean; adminLink?: string | null; spaceName?: string | null; spaceSlug?: string | null } = $props();

	import { browser } from '$app/environment';

	let deleteConfirming = $state(false);
	let menuOpen = $state(false);
	let copied = $state(false);
	let nameEditing = $state(false);
	let userName = $state('');

	if (browser) {
		userName = localStorage.getItem('retro_name') || '';
	}

	function saveName() {
		const trimmed = userName.trim();
		if (browser) {
			localStorage.setItem('retro_name', trimmed);
		}
		nameEditing = false;
	}

	async function deleteBoard() {
		if (!boardStore.board) return;
		deleteConfirming = false;
		menuOpen = false;
		const res = await fetch(`/${boardStore.board.slug}`, { method: 'DELETE' });
		if (res.ok) window.location.href = '/';
	}

	function handleExport(format: 'json' | 'md') {
		if (!boardStore.board) return;
		const url = `/${boardStore.board.slug}/export${format === 'md' ? '?format=md' : ''}`;
		const a = document.createElement('a');
		a.href = url;
		a.download = '';
		a.click();
		menuOpen = false;
	}

	async function copyText(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		menuOpen = false;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:window onclick={() => menuOpen && (menuOpen = false)} />

<header class="border-b border-border bg-surface-card px-4 py-2.5 transition-colors sm:px-6">
	<div class="mx-auto flex max-w-7xl items-center justify-between">
		<!-- Left: brand + breadcrumb -->
		<div class="flex min-w-0 items-center gap-2">
			<a href="/" class="font-heading shrink-0 text-[15px] font-bold tracking-tight text-text-primary">
				{t('header.brand')}
			</a>
			{#if spaceName}
				<span class="text-text-muted text-sm">/</span>
				<a href="/spaces/{spaceSlug}" class="hidden min-w-0 truncate text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary sm:inline">{spaceName}</a>
			{/if}
			{#if boardStore.board}
				{#if spaceName}<span class="hidden text-text-muted text-sm sm:inline">/</span>{/if}
				<span class="text-text-muted text-sm sm:hidden">/</span>
				<span class="min-w-0 max-w-[120px] truncate text-[13px] font-medium text-text-secondary sm:max-w-none">{boardStore.board.title}</span>
			{/if}
		</div>

		<!-- Right: actions -->
		<div class="flex items-center gap-1.5">
			{#if showOnline}
				<UserCount />
			{/if}

			{#if boardStore.board}
				<!-- Single overflow menu for all board actions -->
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
						class="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary {copied ? 'text-accent' : ''}"
						aria-label="Menu"
					>
						{#if copied}
							<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
						{:else}
							<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
						{/if}
					</button>
					{#if menuOpen}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							onclick={(e) => e.stopPropagation()}
							class="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-border bg-surface-card py-1 shadow-lg card-enter"
						>
							<!-- Copy -->
							<button
								onclick={() => copyText(`${window.location.origin}/${boardStore.board?.slug ?? ''}`)}
								class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-surface-hover"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
								{t('copy.link')}
							</button>
							<button
								onclick={() => copyText(boardStore.board?.slug ?? '')}
								class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-surface-hover"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
								{t('copy.code')}
							</button>
							{#if adminLink}
								<button
									onclick={() => copyText(adminLink!)}
									class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-hover"
								>
									<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
									{t('copy.admin')}
								</button>
							{/if}
							<!-- Divider -->
							<hr class="my-1 border-border" />
							<!-- Export -->
							<button
								onclick={() => handleExport('json')}
								class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-surface-hover"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
								{t('export.json')}
							</button>
							<button
								onclick={() => handleExport('md')}
								class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-surface-hover"
							>
								<span class="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-text-muted">MD</span>
								{t('export.markdown')}
							</button>
							<!-- Delete (creator only) -->
							{#if boardStore.isCreator}
								<hr class="my-1 border-border" />
								{#if deleteConfirming}
									<div class="flex items-center gap-1.5 px-3 py-2">
										<span class="text-[12px] text-text-secondary">{t('board.delete.confirm')}</span>
										<button onclick={deleteBoard} class="rounded-md bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600">{t('board.delete')}</button>
										<button onclick={() => (deleteConfirming = false)} class="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-hover">{t('card.cancel')}</button>
									</div>
								{:else}
									<button
										onclick={() => (deleteConfirming = true)}
										class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
									>
										<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
										{t('board.delete')}
									</button>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			{#if showOnline}
				<!-- Name avatar -->
				<div class="relative">
					{#if nameEditing}
						<div class="flex items-center gap-1.5">
							<input
								type="text"
								bind:value={userName}
								onkeydown={(e) => e.key === 'Enter' && saveName()}
								onblur={saveName}
								placeholder="Name"
								class="w-24 rounded-md border border-border bg-surface px-2 py-1 text-[12px] text-text-primary focus:outline-none"
							/>
						</div>
					{:else}
						<button
							onclick={() => (nameEditing = true)}
							class="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors
								{userName ? 'bg-accent text-white' : 'border border-border text-text-muted hover:bg-surface-hover'}"
							title={userName || 'Set name'}
						>
							{userName ? userName[0].toUpperCase() : '?'}
						</button>
					{/if}
				</div>
			{/if}
			<div class="mx-0.5 h-4 w-px bg-border"></div>
			<LocaleToggle />
			<ThemeToggle />
		</div>
	</div>
</header>
