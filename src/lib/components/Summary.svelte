<script lang="ts">
	import { boardStore } from '$lib/stores/board.svelte.js';
	import CommentList from './CommentList.svelte';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let summaryCards = $derived(boardStore.getSummaryCards());

	let expanded = $state<Record<string, boolean>>({});

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well-strong',
		didnt_go_well: 'bg-bad-bg text-bad-strong',
		improve: 'bg-improve-bg text-improve-strong'
	};
</script>

<div class="border-t border-border bg-surface-card/50 p-4 pb-32 sm:p-6 md:pb-10 lg:px-7">
	<div class="mx-auto max-w-[1360px]">
	<h2 class="font-heading mb-4 text-lg font-bold text-text-primary">{t('summary.title')}</h2>

	{#if summaryCards.length === 0}
		<div class="flex flex-col items-center gap-2 py-6 text-center">
			<svg class="h-8 w-8 text-text-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
			<p class="text-[13px] text-text-muted">{t('summary.empty')}</p>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each summaryCards as card, i (card.id)}
				{@const showHeader = card.columnType !== (i > 0 ? summaryCards[i - 1].columnType : '')}
				{@const commentCount = boardStore.getCardComments(card.id).length}
				{#if showHeader}
					<div class="mt-2 first:mt-0">
						<span class="badge-sm {tagColors[card.columnType]}">
							{t(`column.${card.columnType}`)}
						</span>
					</div>
				{/if}
				<div data-testid="summary-card" class="rounded-xl border border-border bg-surface-card px-3 py-2.5 transition-colors hover:border-border-strong">
					<div class="flex items-center gap-2.5">
						<span class="min-w-6 shrink-0 text-center text-[11px] font-semibold tabular-nums text-text-muted">
							{boardStore.getCardLikes(card.id)} &uarr;
						</span>
						{#if card.content}
							<p class="flex-1 text-[13px] text-text-primary">{card.content}</p>
						{:else}
							<p class="flex-1 text-[13px] italic text-text-muted">{t('summary.photo')}</p>
						{/if}
						{#if card.imageId}
							<svg class="h-3.5 w-3.5 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
						{/if}
						<button
							onclick={() => (expanded[card.id] = !expanded[card.id])}
							aria-expanded={!!expanded[card.id]}
							aria-label={commentCount > 0 ? t('comment.count', { n: commentCount }) : t('comment.add')}
							class="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors {commentCount > 0
								? 'bg-accent-bg text-accent hover:opacity-85'
								: 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
						>
							<svg class="h-3 w-3" viewBox="0 0 24 24" fill={commentCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
							{#if commentCount > 0}{commentCount}{:else}{t('comment.add')}{/if}
						</button>
					</div>
					<CommentList cardId={card.id} expanded={!!expanded[card.id]} />
				</div>
			{/each}
		</div>
	{/if}
	</div>
</div>
