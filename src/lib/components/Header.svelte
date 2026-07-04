<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
	import LocaleToggle from './LocaleToggle.svelte';
	import Timer from './Timer.svelte';
	import { page } from '$app/state';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';
	import { t } from '$lib/i18n/index.js';
	import { browser } from '$app/environment';

	let {
		showOnline = false,
		showCreate = false,
		showNav = false,
		adminLink = null,
		spaceName = null,
		spaceSlug = null,
		locked = false,
		creatorToken = null,
		onNewBoard = null
	}: {
		showOnline?: boolean;
		showCreate?: boolean;
		showNav?: boolean;
		adminLink?: string | null;
		spaceName?: string | null;
		spaceSlug?: string | null;
		locked?: boolean;
		creatorToken?: string | null;
		onNewBoard?: (() => void) | null;
	} = $props();

	let deleteConfirming = $state(false);
	let menuOpen = $state(false);
	let copied = $state(false);
	let shared = $state(false);
	let nameEditing = $state(false);
	let userName = $state('');

	if (browser) {
		userName = localStorage.getItem('retro_name') || '';
	}

	let isBoard = $derived(showOnline && !!boardStore.board);
	let othersOnline = $derived(Math.max(0, socketStore.usersCount - 1));

	let navItems = $derived([
		{ key: 'nav.features', href: '/', active: page.url.pathname === '/' },
		{ key: 'nav.changelog', href: '/changelog', active: page.url.pathname.startsWith('/changelog') },
		{ key: 'nav.api', href: '/api', active: page.url.pathname === '/api' },
		{ key: 'nav.feedback', href: null, active: page.url.pathname.startsWith('/feedback') }
	]);

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

	async function share() {
		if (!boardStore.board) return;
		await navigator.clipboard.writeText(`${window.location.origin}/${boardStore.board.slug}`);
		shared = true;
		setTimeout(() => (shared = false), 2000);
	}
</script>

<svelte:window onclick={() => menuOpen && (menuOpen = false)} />

<header class="sticky top-0 z-50 border-b border-border bg-surface-card px-4 py-2.5 transition-colors sm:px-7 sm:py-3">
	<div class="mx-auto flex max-w-[1360px] items-center justify-between gap-3">
		<!-- Left: brand + breadcrumb / nav -->
		{#if isBoard}
			<!-- Desktop: brand + breadcrumbs -->
			<div class="hidden min-w-0 items-baseline gap-3 md:flex">
				<a href="/" class="font-heading shrink-0 text-[18px] font-extrabold tracking-[-0.01em] text-text-primary">
					{t('header.brand')}
				</a>
				{#if spaceName}
					<span class="text-sm text-border-strong">/</span>
					<a href="/spaces/{spaceSlug}" class="min-w-0 truncate text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">{spaceName}</a>
				{/if}
				<span class="text-sm text-border-strong">/</span>
				<span class="min-w-0 truncate text-sm font-semibold text-text-primary">{boardStore.board?.title}</span>
			</div>
			<!-- Mobile: board title + online -->
			<div class="flex min-w-0 flex-col md:hidden">
				<a href={spaceSlug ? `/spaces/${spaceSlug}` : '/'} class="font-heading truncate text-[19px] font-extrabold text-text-primary">{boardStore.board?.title}</a>
				<span class="truncate text-[13px] text-text-muted">{spaceName ?? t('header.brand')} · {t('user.online', { n: socketStore.usersCount })}</span>
			</div>
		{:else}
			<div class="flex min-w-0 items-center gap-7">
				<div class="flex min-w-0 items-baseline gap-3">
					<a href="/" class="font-heading shrink-0 text-[18px] font-extrabold tracking-[-0.01em] text-text-primary">
						{t('header.brand')}
					</a>
					{#if spaceName}
						<span class="text-sm text-border-strong">/</span>
						<span class="min-w-0 truncate text-sm font-semibold text-text-primary">{spaceName}</span>
						{#if locked}
							<span class="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-[3px] text-xs font-semibold text-text-secondary sm:inline-flex">
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
								{t('space.locked')}
							</span>
						{/if}
					{/if}
				</div>
				{#if showNav}
					<nav class="hidden items-center gap-[22px] text-sm font-medium lg:flex">
						{#each navItems as item (item.key)}
							{#if item.href}
								<a
									href={item.href}
									class={item.active
										? 'border-b-2 border-accent pb-0.5 font-bold text-text-primary'
										: 'text-text-secondary transition-colors hover:text-text-primary'}
								>
									{t(item.key)}
								</a>
							{:else}
								<button
									onclick={() => feedbackStore.show()}
									class={item.active
										? 'border-b-2 border-accent pb-0.5 font-bold text-text-primary'
										: 'text-text-secondary transition-colors hover:text-text-primary'}
								>
									{t(item.key)}
								</button>
							{/if}
						{/each}
					</nav>
				{/if}
			</div>
		{/if}

		<!-- Right: actions -->
		<div class="flex shrink-0 items-center gap-2 sm:gap-3">
			{#if isBoard}
				<!-- Timer chip (visible to everyone while running, controls for creator) -->
				<Timer {creatorToken} />

				<!-- Participants: own avatar + others count -->
				<div class="hidden items-center md:flex">
					{#if nameEditing}
						<input
							type="text"
							bind:value={userName}
							onkeydown={(e) => e.key === 'Enter' && saveName()}
							onblur={saveName}
							placeholder={t('name.placeholder')}
							class="input input-sm w-28"
						/>
					{:else}
						<button
							onclick={() => (nameEditing = true)}
							class="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-card text-[13px] font-bold transition-transform hover:scale-105
								{userName ? 'bg-well text-white' : 'bg-surface-hover text-text-muted'}"
							title={userName || t('name.placeholder')}
							aria-label={userName || t('name.placeholder')}
						>
							{#if userName}
								{userName[0].toUpperCase()}
							{:else}
								<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
							{/if}
							<span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-card {socketStore.connected ? 'bg-well' : 'bg-bad'}"></span>
						</button>
						{#if othersOnline > 0}
							<span class="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-card bg-surface-hover text-xs font-bold text-text-secondary">
								+{othersOnline}
							</span>
						{/if}
					{/if}
				</div>

				<!-- Share: primary visible action -->
				<button onclick={share} class="btn btn-dark btn-md hidden md:inline-flex">
					{#if shared}
						<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
						{t('header.share.copied')}
					{:else}
						<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
						{t('header.share')}
					{/if}
				</button>
				<button
					onclick={share}
					class="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-text-primary text-surface md:hidden"
					aria-label={t('header.share')}
					title={t('header.share')}
				>
					{#if shared}
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
					{:else}
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
					{/if}
				</button>

				<!-- Overflow menu: export / delete / settings -->
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
						class="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover {copied ? 'text-accent' : ''}"
						aria-label={t('header.menu')}
						title={t('header.menu')}
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
							class="dropdown absolute right-0 top-full z-50 mt-1.5 w-52 card-enter"
						>
							<button
								onclick={() => copyText(boardStore.board?.slug ?? '')}
								class="dropdown-item"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
								{t('copy.code')}
							</button>
							{#if adminLink}
								<button
									onclick={() => copyText(adminLink!)}
									class="dropdown-item text-text-secondary"
								>
									<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
									{t('copy.admin')}
								</button>
							{/if}
							<hr class="my-1 border-border" />
							<button
								onclick={() => handleExport('json')}
								class="dropdown-item"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
								{t('export.json')}
							</button>
							<button
								onclick={() => handleExport('md')}
								class="dropdown-item"
							>
								<span class="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-text-muted">MD</span>
								{t('export.markdown')}
							</button>
							<a
								href="/api"
								onclick={() => (menuOpen = false)}
								class="dropdown-item"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
								{t('export.api')}
							</a>
							<hr class="my-1 border-border" />
							<!-- Language & theme live in the menu on the board — the header is for board actions -->
							<div class="flex items-center gap-1.5 px-3 py-1.5">
								<LocaleToggle />
								<ThemeToggle />
							</div>
							{#if boardStore.isCreator}
								<hr class="my-1 border-border" />
								{#if deleteConfirming}
									<div class="flex flex-col gap-1.5 px-3 py-2">
										<span class="text-[12px] text-text-secondary">{t('board.delete.confirm')}</span>
										<div class="flex gap-1.5">
											<button onclick={deleteBoard} class="btn btn-danger btn-sm flex-1">{t('board.delete')}</button>
											<button onclick={() => (deleteConfirming = false)} class="btn btn-secondary btn-sm flex-1">{t('card.cancel')}</button>
										</div>
									</div>
								{:else}
									<button
										onclick={() => (deleteConfirming = true)}
										class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-bad transition-colors hover:bg-bad-bg"
									>
										<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
										{t('board.delete')}
									</button>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<a
					href="https://github.com/neckita39/retro-board"
					target="_blank"
					rel="noopener"
					class="btn-icon btn-icon-lg btn-icon-bordered"
					title="GitHub"
					aria-label="GitHub"
				>
					<svg class="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.77 1.05.77 2.13 0 1.53-.01 2.77-.01 3.15 0 .3.2.67.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
				</a>
				<LocaleToggle />
				<ThemeToggle />

				{#if onNewBoard}
					<button onclick={onNewBoard} class="btn btn-primary btn-md">
						<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						<span class="hidden sm:inline">{t('space.boards.create')}</span>
					</button>
				{:else if showCreate}
					<a href="/new" class="btn btn-primary btn-md">
						{t('home.create')}
					</a>
				{/if}
			{/if}
		</div>
	</div>
</header>
