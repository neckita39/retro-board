<script lang="ts">
	import CommentList from './CommentList.svelte';
	import FocusTimer from './FocusTimer.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import type { Card } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let {
		card,
		focused = false,
		discussed = false,
		dimmed = false,
		canControl = false,
		position = null,
		hasNext = false,
		hasPrev = false,
		onJump,
		onNext,
		onPrev
	}: {
		card: Card;
		focused?: boolean;
		discussed?: boolean;
		dimmed?: boolean;
		canControl?: boolean;
		position?: { n: number; total: number } | null;
		hasNext?: boolean;
		hasPrev?: boolean;
		onJump?: () => void;
		onNext?: () => void;
		onPrev?: () => void;
	} = $props();

	let expanded = $state(false);
	let el = $state<HTMLDivElement | null>(null);

	let commentCount = $derived(boardStore.getCardComments(card.id).length);
	let likes = $derived(boardStore.getCardLikes(card.id));

	// Строка сама подъезжает под взгляд, когда обсуждение доходит до неё
	$effect(() => {
		if (!focused || !el) return;
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
	});
</script>

<div
	bind:this={el}
	data-testid="summary-card"
	data-focused={focused ? 'true' : undefined}
	data-discussed={discussed ? 'true' : undefined}
	class="relative rounded-xl transition-all duration-300 {focused
		? 'border-2 border-accent bg-surface-card px-4 py-3.5 shadow-[0_10px_30px_rgba(196,85,43,0.18)]'
		: 'border border-border bg-surface-card px-3 py-2.5 hover:border-border-strong'} {dimmed
		? 'opacity-45'
		: 'opacity-100'}"
>
	<!-- Прозрачный слой для прыжка фокуса — только у ведущего и только во время обсуждения -->
	{#if canControl && !focused}
		<button
			type="button"
			onclick={onJump}
			class="absolute inset-0 z-0 rounded-xl"
			aria-label={card.content || t('summary.photo')}
		></button>
	{/if}

	<div class="relative z-10 {canControl && !focused ? 'pointer-events-none' : ''}">
		{#if focused}
			<div class="mb-2 flex items-center gap-2.5">
				<span class="badge-sm badge-accent shrink-0 tabular-nums">{likes} &uarr;</span>
				{#if position}
					<span class="text-[12px] font-semibold tabular-nums text-text-muted">
						{t('focus.progress', { n: position.n, total: position.total })}
					</span>
				{/if}
				<span class="ml-auto"><FocusTimer /></span>
			</div>
		{/if}

		<div class="flex items-center gap-2.5">
			{#if !focused}
				{#if discussed}
					<span
						class="flex min-w-6 shrink-0 justify-center text-well"
						title={t('focus.discussed')}
						aria-label={t('focus.discussed')}
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12" /></svg>
					</span>
				{:else}
					<span class="min-w-6 shrink-0 text-center text-[11px] font-semibold tabular-nums text-text-muted">
						{likes} &uarr;
					</span>
				{/if}
			{/if}

			{#if card.content}
				<p class="flex-1 {focused ? 'text-[15px] leading-relaxed' : 'text-[13px]'} text-text-primary">{card.content}</p>
			{:else}
				<p class="flex-1 {focused ? 'text-[15px]' : 'text-[13px]'} italic text-text-muted">{t('summary.photo')}</p>
			{/if}

			{#if card.imageId}
				<svg class="h-3.5 w-3.5 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
			{/if}

			<button
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
				aria-label={commentCount > 0 ? t('comment.count', { n: commentCount }) : t('comment.add')}
				class="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors {commentCount >
				0
					? 'bg-accent-bg text-accent hover:opacity-85'
					: 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill={commentCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
				{#if commentCount > 0}{commentCount}{:else}{t('comment.add')}{/if}
			</button>
		</div>

		{#if focused && canControl}
			<div class="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
				<button
					onclick={onPrev}
					disabled={!hasPrev}
					class="btn btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
				>
					&larr; {t('focus.prev')}
				</button>
				<button
					onclick={onNext}
					disabled={!hasNext}
					class="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
				>
					{t('focus.next')} &rarr;
				</button>
			</div>
		{/if}

		<CommentList cardId={card.id} {expanded} />
	</div>
</div>
