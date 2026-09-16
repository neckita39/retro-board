<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n/index.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { ANALYSIS_FORMAT } from '$lib/formats.js';
	import AnalyzeButton from './AnalyzeButton.svelte';
	import { truncatedTitle } from '$lib/actions/truncated-title.js';
	import type { AnalysisState } from '$lib/analysis-state.js';

	interface SpaceBoard {
		slug: string;
		title: string;
		format: string;
		createdAt: string;
		cardCount: number;
		wellCount: number;
		badCount: number;
		improveCount: number;
	}

	let {
		boards,
		onNewBoard,
		analysis = null,
		spaceSlug
	}: { boards: SpaceBoard[]; onNewBoard: () => void; analysis?: AnalysisState | null; spaceSlug: string } = $props();

	// Заглушка держится и после ready, пока invalidateAll не принесёт доску в список
	let showPending = $derived.by(() => {
		const a = analysis;
		if (!a) return false;
		if (a.state === 'pending') return true;
		return a.state === 'ready' && !boards.some((b) => b.slug === a.board.slug);
	});

	let search = $state('');
	let sortOrder = $state<'newest' | 'oldest'>('newest');

	let filtered = $derived.by(() => {
		const list = search.trim()
			? boards.filter((b) => b.title.toLowerCase().includes(search.trim().toLowerCase()))
			: [...boards];
		// Boards come from the server newest-first
		return sortOrder === 'newest' ? list : list.reverse();
	});

	const DAY = 24 * 60 * 60 * 1000;

	// A board created within the last day is probably the retro happening right now.
	// Доска-анализ — не встреча, у неё «сейчас идёт» не бывает
	function isLive(board: SpaceBoard): boolean {
		return board.format !== ANALYSIS_FORMAT && Date.now() - new Date(board.createdAt).getTime() < DAY;
	}

	function relativeDate(iso: string): string {
		const locale = localeStore.locale === 'ru' ? 'ru-RU' : 'en-US';
		const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
		const diff = new Date(iso).getTime() - Date.now();
		const days = Math.round(diff / DAY);
		if (days > -7) return rtf.format(days, 'day');
		if (days > -30) return rtf.format(Math.round(days / 7), 'week');
		if (days > -365) return rtf.format(Math.round(days / 30), 'month');
		return rtf.format(Math.round(days / 365), 'year');
	}
</script>

<div class="flex flex-col gap-5">
	<!-- Toolbar: sort + search -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<button
			onclick={() => (sortOrder = sortOrder === 'newest' ? 'oldest' : 'newest')}
			class="btn btn-secondary btn-sm"
		>
			{t(sortOrder === 'newest' ? 'space.sort.newest' : 'space.sort.oldest')}
			<span class="text-text-muted">{sortOrder === 'newest' ? '▾' : '▴'}</span>
		</button>
		<div class="relative w-full max-w-[240px]">
			<svg class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<input
				type="text"
				bind:value={search}
				placeholder={t('space.boards.search')}
				class="input input-sm pl-8 pr-3"
			/>
		</div>
	</div>

	<!-- Tile grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- "New board" tile — creation is never hidden -->
		{#if !search.trim()}
			<button
				onclick={onNewBoard}
				class="tile-enter flex min-h-[150px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border-strong text-accent transition-all duration-300 hover:-translate-y-0.5 hover:border-accent"
			>
				<span class="flex h-10 w-10 items-center justify-center rounded-full bg-accent-bg">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
				</span>
				<span class="text-sm font-bold">{t('space.boards.create')}</span>
			</button>
			{#if showPending && analysis && analysis.state !== 'idle'}
				<div
					class="tile-enter ai-frame flex min-h-[150px] flex-col gap-3.5 rounded-2xl bg-surface-card p-5 [--ai-frame-bg:var(--color-surface-card)]"
					aria-busy="true"
					data-testid="analysis-pending"
				>
					<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary" use:truncatedTitle={analysis.title}>{analysis.title}</span>
					<div class="mt-auto flex items-center justify-between gap-2 text-[13px] font-semibold text-text-secondary">
						<span class="flex min-w-0 items-center gap-2">
							<svg class="h-4 w-4 shrink-0 animate-spin text-ai-from" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
							{t('space.analysis.tile.pending')}
						</span>
						<span class="badge-sm badge-ai shrink-0">{t('analysis.badge')}</span>
					</div>
				</div>
			{:else if analysis?.state === 'failed'}
				<div
					class="tile-enter ai-frame flex min-h-[150px] flex-col gap-3 rounded-2xl bg-surface-card p-5 opacity-90 [--ai-frame-bg:var(--color-surface-card)]"
					data-testid="analysis-failed"
				>
					<div class="flex items-start justify-between gap-2">
						<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary" use:truncatedTitle={analysis.title}>{analysis.title}</span>
						<span class="flex shrink-0 items-center gap-1.5">
							<!-- Крестик: убирает упавшую попытку у всех в пространстве -->
							<form method="POST" action="/spaces/{spaceSlug}?/dismissAnalysis" class="contents" use:enhance>
								<button
									type="submit"
									class="btn-icon text-text-muted hover:text-text-primary"
									title={t('space.analysis.tile.dismiss')}
									aria-label={t('space.analysis.tile.dismiss')}
									data-testid="analysis-dismiss"
								>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							</form>
						</span>
					</div>
					<p class="text-[13px] leading-snug text-bad">
						{t('space.analysis.tile.failed')}: {t(`space.analysis.error.${analysis.error}`)}
					</p>
					<div class="mt-auto flex items-center justify-between gap-2">
						<AnalyzeButton {spaceSlug} variant="retry" />
						<span class="badge-sm badge-ai shrink-0">{t('analysis.badge')}</span>
					</div>
				</div>
			{/if}
		{/if}

		{#each filtered as board, i (board.slug)}
			<a
				href="/{board.slug}"
				class="tile-enter flex min-h-[150px] flex-col gap-3.5 rounded-2xl bg-surface-card p-5 transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] {board.format === ANALYSIS_FORMAT
					? 'ai-frame [--ai-frame-bg:var(--color-surface-card)]'
					: 'border border-border hover:border-border-strong'}"
				style="animation-delay: {Math.min(i, 8) * 70}ms"
				data-testid="space-tile"
				data-format={board.format}
			>
				<div class="flex items-start justify-between gap-2">
					<!-- Обрезанное название целиком видно по наведению; влезает — подсказки нет -->
					<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary" use:truncatedTitle={board.title}>{board.title}</span>
					{#if isLive(board)}
						<span class="shrink-0 rounded-full bg-accent-bg px-[9px] py-[3px] text-[11px] font-bold text-accent">{t('space.tile.live')}</span>
					{/if}
				</div>
				<div class="mt-auto flex flex-col gap-1.5">
					{#if board.format === ANALYSIS_FORMAT}
						<!-- У доски-анализа нет классических колонок — вместо полосы настроения её градиент -->
						<div class="h-[5px] rounded-full bg-gradient-to-r from-ai-from to-ai-to"></div>
					{:else}
						<!-- Mood bar: card share per column, in column colors -->
						<div class="flex h-[5px] gap-1 overflow-hidden rounded-full">
							{#if board.cardCount > 0}
								{#if board.wellCount > 0}<div class="rounded-full bg-well" style="flex: {board.wellCount}"></div>{/if}
								{#if board.badCount > 0}<div class="rounded-full bg-bad" style="flex: {board.badCount}"></div>{/if}
								{#if board.improveCount > 0}<div class="rounded-full bg-improve" style="flex: {board.improveCount}"></div>{/if}
							{:else}
								<div class="flex-1 rounded-full bg-surface-hover"></div>
							{/if}
						</div>
					{/if}
					<div class="flex items-center justify-between gap-2 text-[13px] text-text-muted">
						<span class="flex min-w-0 items-center gap-2">
							{#if board.format === ANALYSIS_FORMAT}
								<span class="badge-sm badge-ai shrink-0">{t('analysis.badge')}</span>
							{/if}
							<span class="truncate">{t('space.boards.cards', { n: board.cardCount })}</span>
						</span>
						<span class="shrink-0">{relativeDate(board.createdAt)}</span>
					</div>
				</div>
			</a>
		{/each}
	</div>

	<!-- Empty / no results -->
	{#if boards.length === 0}
		<p class="text-center text-sm text-text-muted">{t('space.boards.empty')}</p>
	{:else if filtered.length === 0 && search.trim()}
		<p class="text-center text-sm text-text-muted">{t('space.boards.no_results')}</p>
	{/if}
</div>
