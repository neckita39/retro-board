<script lang="ts">
	import LocaleToggle from './LocaleToggle.svelte';
	import Timer from './Timer.svelte';
	import AnalyzeButton from './AnalyzeButton.svelte';
	import AiBadge from './AiBadge.svelte';
	import { page } from '$app/state';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';
	import { searchStore } from '$lib/stores/search.svelte.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';
	import { normalizeTitle, TITLE_MAX } from '$lib/titles.js';
	import { ANALYSIS_FORMAT } from '$lib/formats.js';
	import { truncatedTitle } from '$lib/actions/truncated-title.js';
	import { browser } from '$app/environment';

	let {
		showOnline = false,
		showCreate = false,
		showNav = false,
		adminLink = null,
		spaceName = null,
		spaceSlug = null,
		creatorToken = null,
		onNewBoard = null,
		analysis = null
	}: {
		showOnline?: boolean;
		showCreate?: boolean;
		showNav?: boolean;
		adminLink?: string | null;
		/** Пространство доски — ссылка в крошках на странице доски. На остальных
		 *  страницах шапка показывает только марку, имя пространства живёт в H1 */
		spaceName?: string | null;
		spaceSlug?: string | null;
		creatorToken?: string | null;
		onNewBoard?: (() => void) | null;
		/** Пространство, для которого показать «Анализ пространства»:
		 *  на доске — пункт меню «⋯», на странице пространства — кнопка в шапке */
		analysis?: { spaceSlug: string } | null;
	} = $props();

	let deleteConfirming = $state(false);
	let menuOpen = $state(false);
	let copied = $state(false);
	let shared = $state(false);
	let nameEditing = $state(false);
	let userName = $state('');
	let renaming = $state(false);
	let renameValue = $state('');

	if (browser) {
		userName = localStorage.getItem('retro_name') || '';
	}

	let isBoard = $derived(showOnline && !!boardStore.board);
	let othersOnline = $derived(Math.max(0, socketStore.usersCount - 1));

	// «Возможности» вёл на '/', куда уже ведёт логотип слева. Место занял раздел
	// форматов — в отличие от дубля ссылки, он даёт вес странице, которая должна
	// ранжироваться.
	let navItems = $derived([
		{ key: 'nav.formats', href: '/formats', active: page.url.pathname.startsWith('/formats') },
		{ key: 'nav.guide', href: '/how-to-run-a-retro', active: page.url.pathname === '/how-to-run-a-retro' },
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

	function startRename() {
		if (!boardStore.board) return;
		renameValue = boardStore.board.title;
		renaming = true;
		menuOpen = false;
	}

	// Пустое имя не сохраняем и инпут не закрываем — пусть поправят или нажмут Esc.
	// Проверка renaming нужна: после Esc инпут исчезает и на нём срабатывает blur.
	function commitRename() {
		if (!renaming) return;
		const title = normalizeTitle(renameValue);
		if (!title) return;
		if (title !== boardStore.board?.title) socketStore.renameBoard(title, creatorToken);
		renaming = false;
	}

	function cancelRename() {
		renaming = false;
	}

	// Ушли из поля с пустым именем — считаем это отменой, а не зависшим инпутом
	function onRenameBlur() {
		if (!renaming) return;
		if (normalizeTitle(renameValue)) commitRename();
		else cancelRename();
	}

	function onRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitRename();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelRename();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
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

	// «Скопировать итоги» — тот же Markdown, что и в экспорте, но сразу в буфер:
	// чаще всего итоги ретро несут в чат команды, а не сохраняют файлом.
	// Safari теряет право на запись в буфер после await, поэтому, если браузер
	// умеет ClipboardItem с промисом, отдаём ему промис — жест остаётся «живым»
	async function copySummary() {
		if (!boardStore.board) return;
		menuOpen = false;
		const url = `/${boardStore.board.slug}/export?format=md&lang=${localeStore.locale}`;
		try {
			if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
				const blob = fetch(url).then((r) => {
					if (!r.ok) throw new Error(String(r.status));
					return r.blob().then((b) => new Blob([b], { type: 'text/plain' }));
				});
				await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
			} else {
				const res = await fetch(url);
				if (!res.ok) throw new Error(String(res.status));
				await navigator.clipboard.writeText(await res.text());
			}
			toastStore.push({ kind: 'success', text: t('export.copied') });
		} catch {
			toastStore.push({ kind: 'error', text: t('export.copyFailed') });
		}
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

<!-- Инпут переименования: один и тот же в десктопных крошках и мобильном заголовке -->
{#snippet renameField(cls: string)}
	<input
		type="text"
		bind:value={renameValue}
		use:focusAndSelect
		onkeydown={onRenameKey}
		onblur={onRenameBlur}
		maxlength={TITLE_MAX}
		aria-label={t('board.rename.label')}
		class={cls}
	/>
{/snippet}

{#snippet shareIcon(cls: string)}
	{#if shared}
		<svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
	{:else}
		<svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
	{/if}
{/snippet}

<!-- Одна высота на всю строку: каждый контрол 38px, радиус 12 -->
<header class="sticky top-0 z-50 border-b border-border bg-surface-card px-4 py-2.5 transition-colors sm:px-7 sm:py-3">
	<div class="mx-auto flex max-w-[1360px] items-center justify-between gap-3">
		<!-- Left: brand + breadcrumb / nav -->
		{#if isBoard}
			<!-- Desktop: brand / space / board title + pencil -->
			<div class="hidden min-w-0 items-center gap-3 md:flex">
				<a href="/" class="font-heading shrink-0 text-[18px] font-extrabold tracking-[-0.01em] text-text-primary">
					{t('header.brand')}
				</a>
				{#if spaceName}
					<span class="text-sm text-border-strong">/</span>
					<a href="/spaces/{spaceSlug}" class="min-w-0 truncate text-sm font-medium text-text-secondary transition-colors hover:text-text-primary" use:truncatedTitle={spaceName}>{spaceName}</a>
				{/if}
				<span class="text-sm text-border-strong">/</span>
				{#if renaming}
					{@render renameField('input input-md min-w-0 flex-1 text-sm font-semibold')}
				{:else}
					<span class="min-w-0 truncate text-sm font-semibold text-text-primary" use:truncatedTitle={boardStore.board?.title ?? ''}>{boardStore.board?.title}</span>
				{/if}
				{#if boardStore.board?.format === ANALYSIS_FORMAT}
					<AiBadge />
				{/if}
				{#if boardStore.isCreator && !renaming}
					<!-- Подсказка — «Переименовать доску», но доступное имя другое: пункт меню
					     с тем же именем остаётся, и e2e ищет его по роли и имени -->
					<button
						onclick={startRename}
						class="btn-icon btn-icon-sm shrink-0"
						title={t('board.rename')}
						aria-label={t('board.rename.label')}
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
					</button>
				{/if}
			</div>
			<!-- Mobile: board title + online -->
			<div class="flex min-w-0 flex-col md:hidden">
				{#if renaming}
					{@render renameField('input input-md font-heading min-w-0 text-[17px] font-extrabold')}
				{:else}
					<a href={spaceSlug ? `/spaces/${spaceSlug}` : '/'} class="font-heading truncate text-[17px] font-extrabold text-text-primary" use:truncatedTitle={boardStore.board?.title ?? ''}>{boardStore.board?.title}</a>
				{/if}
				<span class="truncate text-[13px] text-text-muted">
					{#if boardStore.board?.format === ANALYSIS_FORMAT}<span class="mr-1 inline-flex align-middle"><AiBadge /></span>{/if}
					{spaceName ?? t('header.brand')} · {t('user.online', { n: socketStore.usersCount })}
				</span>
			</div>
		{:else}
			<div class="flex min-w-0 items-center gap-7">
				<!-- До sm полное имя не влезает рядом с иконками и кнопкой. Показываем марку,
				     а название прячем визуально: в разметке и в дереве доступности оно остаётся. -->
				<a href="/" class="font-heading flex shrink-0 items-center text-[18px] font-extrabold tracking-[-0.01em] text-text-primary">
					<span class="flex h-7 w-7 items-center justify-center rounded-lg bg-text-primary text-[15px] text-surface sm:hidden" aria-hidden="true">
						{t('header.brand').charAt(0)}
					</span>
					<span class="sr-only sm:not-sr-only">{t('header.brand')}</span>
				</a>
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

				<!-- Participants: own ink avatar + others count -->
				<div class="hidden items-center gap-1.5 md:flex">
					{#if nameEditing}
						<input
							type="text"
							bind:value={userName}
							onkeydown={(e) => e.key === 'Enter' && saveName()}
							onblur={() => document.hasFocus() && saveName()}
							placeholder={t('name.placeholder')}
							class="input input-md w-32"
						/>
					{:else}
						<button
							onclick={() => (nameEditing = true)}
							class="relative flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-transform hover:scale-105
								{userName ? 'bg-text-primary text-surface' : 'bg-surface-hover text-text-muted'}"
							title={userName || t('name.placeholder')}
							aria-label={userName || t('name.placeholder')}
						>
							{#if userName}
								{userName[0].toUpperCase()}
							{:else}
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
							{/if}
							<span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-card {socketStore.connected ? 'bg-well' : 'bg-bad'}"></span>
						</button>
						{#if othersOnline > 0}
							<!-- Счётчик, а не аватар: без нахлёста (иначе индикатор связи налезает)
							     и с авторастущей шириной — фиксированный круг ломался на больших командах -->
							<span
								class="flex h-8 min-w-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-surface-hover px-2 text-[13px] font-bold tabular-nums text-text-secondary"
								title={t('user.online', { n: socketStore.usersCount })}
								aria-label={t('user.online', { n: socketStore.usersCount })}
							>
								{othersOnline > 99 ? '99+' : `+${othersOnline}`}
							</span>
						{/if}
					{/if}
				</div>

				<button
					onclick={() => searchStore.toggle()}
					class="btn-icon btn-icon-lg btn-icon-bordered"
					aria-label={t('search.open')}
					title={t('search.open')}
					data-testid="board-search-toggle"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				</button>

				<!-- Share: the one dark action in the row -->
				<button onclick={share} class="btn btn-dark btn-md hidden md:inline-flex">
					{@render shareIcon('h-4 w-4')}
					{shared ? t('header.share.copied') : t('header.share')}
				</button>
				<button
					onclick={share}
					class="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-text-primary text-surface md:hidden"
					aria-label={t('header.share')}
					title={t('header.share')}
				>
					{@render shareIcon('h-4 w-4')}
				</button>

				<!-- Overflow menu: copy / export / analysis / settings / rename / delete -->
				<div class="relative">
					<button
						onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
						class="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover {copied ? 'text-well' : ''}"
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
								<span class="flex h-4 w-4 items-center justify-center text-[11px] font-bold text-text-muted">MD</span>
								{t('export.markdown')}
							</button>
							<button
								onclick={copySummary}
								class="dropdown-item"
								data-testid="menu-copy-summary"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
								{t('export.copySummary')}
							</button>
							<a
								href="/api"
								onclick={() => (menuOpen = false)}
								class="dropdown-item"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
								{t('export.api')}
							</a>
							{#if analysis}
								<!-- «Анализ пространства» живёт в меню: в строке шапки одна тёмная кнопка -->
								<hr class="my-1 border-border" />
								<AnalyzeButton spaceSlug={analysis.spaceSlug} variant="menu" onSubmit={() => (menuOpen = false)} />
							{/if}
							<hr class="my-1 border-border" />
							<!-- Language lives in the menu on the board — the header is for board actions -->
							<div class="flex items-center gap-1.5 px-3 py-1.5">
								<LocaleToggle />
							</div>
							{#if boardStore.isCreator}
								<hr class="my-1 border-border" />
							<button
								onclick={() => { socketStore.setBlind(!boardStore.blind, creatorToken); menuOpen = false; }}
								class="dropdown-item"
								data-testid="menu-blind"
							>
								<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									{#if boardStore.blind}
										<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
									{:else}
										<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
									{/if}
								</svg>
								{boardStore.blind ? t('blind.reveal') : t('blind.start')}
							</button>
								<button onclick={startRename} class="dropdown-item">
									<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
									{t('board.rename')}
								</button>
								{#if boardStore.bitrixOffer && spaceSlug}
									<!-- Подключить может только создатель пространства: ?bitrix=1 открывает панель и ставит фокус в поле -->
									<a
										href="/spaces/{spaceSlug}?bitrix=1"
										onclick={() => (menuOpen = false)}
										class="dropdown-item"
										data-testid="menu-bitrix-connect"
									>
										<svg class="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
										{t('bitrix.menu.connect')}
									</a>
								{/if}
								{#if deleteConfirming}
									<div class="flex flex-col gap-1.5 px-3 py-2">
										<span class="text-[13px] text-text-secondary">{t('board.delete.confirm')}</span>
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
				<!-- GitHub only on site pages; the space page keeps the row to its own actions -->
				{#if showNav}
					<a
						href="https://github.com/neckita39/retro-board"
						target="_blank"
						rel="noopener"
						class="btn-icon btn-icon-lg btn-icon-bordered"
						title="GitHub"
						aria-label="GitHub"
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.77 1.05.77 2.13 0 1.53-.01 2.77-.01 3.15 0 .3.2.67.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
					</a>
				{/if}
				<LocaleToggle />

				{#if analysis}
					<AnalyzeButton spaceSlug={analysis.spaceSlug} compact />
				{/if}
				{#if onNewBoard}
					<button onclick={onNewBoard} class="btn btn-primary btn-md">
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						<span class="hidden sm:inline">{t('space.boards.create')}</span>
					</button>
				{:else if showCreate}
					<a href="/new" class="btn btn-primary btn-md">
						<span class="sm:hidden">{t('home.create.short')}</span>
						<span class="hidden sm:inline">{t('home.create')}</span>
					</a>
				{/if}
			{/if}
		</div>
	</div>
</header>
