<script lang="ts">
	import { t } from '$lib/i18n/index.js';

	interface SpaceBoard {
		slug: string;
		title: string;
		createdAt: string;
		cardCount: number;
		wellCount: number;
		badCount: number;
		improveCount: number;
	}

	let { boards, spaceSlug }: { boards: SpaceBoard[]; spaceSlug: string } = $props();

	let creating = $state(false);
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-text-primary">{t('space.boards.title')}</h2>
		{#if !creating}
			<button
				onclick={() => (creating = true)}
				class="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				{t('space.boards.create')}
			</button>
		{/if}
	</div>

	{#if creating}
		<form
			method="POST"
			action="/spaces/{spaceSlug}?/createBoard"
			class="rounded-xl border border-border bg-surface-card p-4"
		>
			<div class="flex gap-3">
				<input
					type="text"
					name="title"
					maxlength="100"
					placeholder={t('space.boards.create.placeholder')}
					class="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
				/>
				<button
					type="submit"
					class="rounded-lg bg-text-primary px-4 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90"
				>
					{t('home.create')}
				</button>
				<button
					type="button"
					onclick={() => (creating = false)}
					class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
				>
					{t('card.cancel')}
				</button>
			</div>
		</form>
	{/if}

	{#if boards.length === 0 && !creating}
		<p class="text-sm text-text-muted">{t('space.boards.empty')}</p>
	{/if}

	{#if boards.length > 0}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each boards as board}
				<a
					href="/{board.slug}"
					class="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface-card transition-all hover:border-border-strong hover:shadow-md"
				>
					<!-- Blurred board preview background -->
					<div class="relative h-20 overflow-hidden">
						<div
							class="absolute inset-0 bg-cover bg-center blur-[2px] scale-110 opacity-80 dark:opacity-40"
							style="background-image: url('/board-bg.png')"
						></div>
						<!-- Column indicators overlay -->
						<div class="relative flex h-full items-end gap-1 p-3">
							{#if board.wellCount > 0}
								<div class="flex items-center gap-0.5 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-well dark:bg-black/30">
									+ {board.wellCount}
								</div>
							{/if}
							{#if board.badCount > 0}
								<div class="flex items-center gap-0.5 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-bad dark:bg-black/30">
									− {board.badCount}
								</div>
							{/if}
							{#if board.improveCount > 0}
								<div class="flex items-center gap-0.5 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-improve dark:bg-black/30">
									! {board.improveCount}
								</div>
							{/if}
						</div>
					</div>
					<!-- Board info -->
					<div class="flex flex-1 flex-col gap-1 p-3">
						<span class="truncate text-sm font-medium text-text-primary">{board.title}</span>
						<div class="flex items-center gap-3 text-xs text-text-muted">
							<span>{new Date(board.createdAt).toLocaleDateString()}</span>
							<span>{t('space.boards.cards', { n: board.cardCount })}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
