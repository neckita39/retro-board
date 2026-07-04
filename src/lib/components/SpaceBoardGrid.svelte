<script lang="ts">
	import { t } from '$lib/i18n/index.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';

	interface SpaceBoard {
		slug: string;
		title: string;
		createdAt: string;
		cardCount: number;
		wellCount: number;
		badCount: number;
		improveCount: number;
	}

	let { boards, onNewBoard }: { boards: SpaceBoard[]; onNewBoard: () => void } = $props();

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

	// A board created within the last day is probably the retro happening right now
	function isLive(board: SpaceBoard): boolean {
		return Date.now() - new Date(board.createdAt).getTime() < DAY;
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
		{/if}

		{#each filtered as board, i (board.slug)}
			<a
				href="/{board.slug}"
				class="tile-enter flex min-h-[150px] flex-col gap-3.5 rounded-2xl border border-border bg-surface-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-border-strong active:scale-[0.98]"
				style="animation-delay: {Math.min(i, 8) * 70}ms"
			>
				<div class="flex items-start justify-between gap-2">
					<span class="font-heading min-w-0 truncate text-base font-bold text-text-primary">{board.title}</span>
					{#if isLive(board)}
						<span class="shrink-0 rounded-full bg-accent-bg px-[9px] py-[3px] text-[11px] font-bold text-accent">{t('space.tile.live')}</span>
					{/if}
				</div>
				<div class="mt-auto flex flex-col gap-1.5">
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
					<div class="flex items-center justify-between text-[13px] text-text-muted">
						<span>{t('space.boards.cards', { n: board.cardCount })}</span>
						<span>{relativeDate(board.createdAt)}</span>
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
