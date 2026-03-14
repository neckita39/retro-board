<script lang="ts">
	import { t } from '$lib/i18n/index.js';

	interface SpaceBoard {
		slug: string;
		title: string;
		createdAt: string;
		cardCount: number;
	}

	let { boards, spaceSlug }: { boards: SpaceBoard[]; spaceSlug: string } = $props();

	let creating = $state(false);
	let search = $state('');

	let filtered = $derived(
		search.trim()
			? boards.filter(b => b.title.toLowerCase().includes(search.trim().toLowerCase()))
			: boards
	);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	}
</script>

<div>
	<!-- Section header -->
	<div class="mb-4 flex items-center justify-between gap-3">
		<span class="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-secondary">
			{t('space.boards.title')} · {boards.length}
		</span>
		<div class="relative flex-1 max-w-xs">
				<svg class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				<input
					type="text"
					bind:value={search}
					placeholder={t('space.boards.search')}
					class="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
				/>
			</div>
		{#if !creating}
			<button
				onclick={() => (creating = true)}
				class="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.97]"
			>
				+ {t('space.boards.create')}
			</button>
		{/if}
	</div>

	<!-- Create board inline form -->
	{#if creating}
		<form
			method="POST"
			action="/spaces/{spaceSlug}?/createBoard"
			class="card-enter mb-4 rounded-xl border border-border bg-surface-card p-4"
		>
			<div class="flex gap-3">
				<input
					type="text"
					name="title"
					maxlength="100"
					placeholder={t('space.boards.create.placeholder')}
					class="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none focus:ring-2 focus:ring-border"
				/>
				<button
					type="submit"
					class="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.97]"
				>
					{t('home.create')}
				</button>
				<button
					type="button"
					onclick={() => (creating = false)}
					class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-hover"
				>
					{t('card.cancel')}
				</button>
			</div>
		</form>
	{/if}

	<!-- Tile grid -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each filtered as board, i}
			<a
				href="/{board.slug}"
				class="tile-enter group block overflow-hidden rounded-[14px] border border-border bg-surface-card transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-1.5 hover:scale-[1.01] hover:border-border-strong hover:shadow-lg active:scale-[0.98]"
				style="animation-delay: {i * 70}ms"
			>
				<!-- Mini preview -->
				<div class="h-[72px] overflow-hidden" style="background: linear-gradient(135deg, var(--color-well-bg) 0%, var(--color-well-bg) 33%, var(--color-bad-bg) 33%, var(--color-bad-bg) 66%, var(--color-improve-bg) 66%);">
					<div class="flex h-full gap-px p-2.5">
						<div class="flex flex-1 flex-col gap-1">
							<div class="h-1 w-[85%] rounded-full bg-well opacity-30"></div>
							<div class="h-1 w-[60%] rounded-full bg-well opacity-30"></div>
							<div class="h-1 w-[70%] rounded-full bg-well opacity-30"></div>
						</div>
						<div class="flex flex-1 flex-col gap-1">
							<div class="h-1 w-[75%] rounded-full bg-bad opacity-30"></div>
							<div class="h-1 w-[50%] rounded-full bg-bad opacity-30"></div>
						</div>
						<div class="flex flex-1 flex-col gap-1">
							<div class="h-1 w-[65%] rounded-full bg-improve opacity-30"></div>
							<div class="h-1 w-[80%] rounded-full bg-improve opacity-30"></div>
						</div>
					</div>
				</div>
				<!-- Info -->
				<div class="px-3 py-2.5">
					<div class="truncate text-sm font-semibold text-text-primary">{board.title}</div>
					<div class="mt-0.5 flex gap-2 text-xs text-text-muted">
						<span>{formatDate(board.createdAt)}</span>
						<span>{t('space.boards.cards', { n: board.cardCount })}</span>
					</div>
				</div>
			</a>
		{/each}

		<!-- Add tile -->
		{#if !creating && !search.trim()}
			<button
				onclick={() => (creating = true)}
				class="tile-enter flex min-h-[120px] flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-border transition-all duration-300 hover:-translate-y-0.5 hover:border-text-primary hover:bg-surface-hover"
				style="animation-delay: {boards.length * 60}ms"
			>
				<div class="mb-1 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-hover text-text-muted transition-all duration-300 group-hover:scale-110">
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
				</div>
				<span class="text-xs font-medium text-text-muted">{t('space.boards.create')}</span>
			</button>
		{/if}
	</div>

	<!-- Empty / no results -->
	{#if boards.length === 0 && !creating}
		<p class="mt-4 text-center text-sm text-text-muted">{t('space.boards.empty')}</p>
	{:else if filtered.length === 0 && search.trim()}
		<p class="mt-4 text-center text-sm text-text-muted">{t('space.boards.no_results')}</p>
	{/if}
</div>
