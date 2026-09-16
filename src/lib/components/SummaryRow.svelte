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
		onPrev,
		onStop
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
		onStop?: () => void;
	} = $props();

	let expanded = $state(false);
	let el = $state<HTMLDivElement | null>(null);

	let commentCount = $derived(boardStore.getCardComments(card.id).length);
	let likes = $derived(boardStore.getCardLikes(card.id));
	let dislikes = $derived(boardStore.getCardDislikes(card.id));
	let score = $derived(likes - dislikes);
	// Итог — это лайки минус дизлайки. Разбивку показываем только там, где были
	// возражения: она объясняет, почему число разошлось с лайками. Без дизлайков
	// «7 (7/-0)» — лишний шум, и так видно, что это семь лайков.
	let scoreLabel = $derived(dislikes > 0 ? `${score} (${likes}/-${dislikes})` : `${score}`);

	// Строка сама подъезжает под взгляд, когда обсуждение доходит до неё
	$effect(() => {
		if (!focused || !el) return;
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
	});
</script>

<!-- Счётчик комментариев: 28px, нейтральная заливка при наличии комментариев,
     без заливки и рамки — пока их нет. В обычной строке стоит справа в ряду,
     в обсуждаемой — уезжает в ряд с кнопками «Назад» / «Далее» -->
{#snippet commentPill()}
	<button
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		aria-label={commentCount > 0 ? t('comment.count', { n: commentCount }) : t('comment.add')}
		class="pointer-events-auto inline-flex h-7 shrink-0 items-center gap-[5px] rounded-full px-2.5 text-[13px] font-semibold transition-colors {commentCount >
		0
			? 'bg-surface-hover text-text-primary hover:opacity-85'
			: 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
	>
		<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
		{#if commentCount > 0}{commentCount}{:else}{t('comment.add')}{/if}
	</button>
{/snippet}

<div
	bind:this={el}
	data-testid="summary-card"
	data-focused={focused ? 'true' : undefined}
	data-discussed={discussed ? 'true' : undefined}
	data-dimmed={dimmed ? 'true' : undefined}
	class="relative rounded-xl bg-surface-card transition-all duration-300 {focused
		? 'border-2 border-accent px-4 py-3.5'
		: 'border border-border px-3.5 py-2.5 hover:border-border-strong'} {dimmed
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
			<div class="mb-2.5 flex items-center gap-2.5">
				<span class="badge-sm badge-accent shrink-0 tabular-nums">{scoreLabel}</span>
				{#if position}
					<span class="shrink-0 text-[13px] font-semibold tabular-nums text-text-muted">
						{t('focus.progress', { n: position.n, total: position.total })}
					</span>
				{/if}
				{#if card.authorName}
					<span class="min-w-0 truncate text-[13px] text-text-muted">· {card.authorName}</span>
				{/if}
				<span class="ml-auto"><FocusTimer /></span>
			</div>
		{/if}

		<div class="flex items-center gap-2.5">
			{#if !focused}
				{#if discussed}
					<span
						class="flex min-w-6 shrink-0 justify-center text-well"
						role="img"
						title={t('focus.discussed')}
						aria-label="{t('focus.discussed')} — {scoreLabel}"
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12" /></svg>
					</span>
				{:else}
					<span class="flex min-w-6 shrink-0 justify-center whitespace-nowrap text-[13px] font-semibold tabular-nums text-text-muted">
						{scoreLabel}
					</span>
				{/if}
			{/if}

			{#if card.content}
				<p class="min-w-0 flex-1 text-[15px] text-text-primary {focused ? 'leading-[1.6]' : 'leading-[1.4]'}">{card.content}</p>
			{:else}
				<p class="min-w-0 flex-1 text-[15px] italic text-text-muted {focused ? 'leading-[1.6]' : 'leading-[1.4]'}">{t('summary.photo')}</p>
			{/if}

			{#if card.imageId}
				<svg class="h-3.5 w-3.5 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
			{/if}

			{#if !focused}
				{#if card.authorName}
					<span class="max-w-28 shrink-0 truncate text-[13px] text-text-muted">{card.authorName}</span>
				{/if}
				{@render commentPill()}
			{/if}
		</div>

		{#if focused}
			<div class="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
				{#if canControl}
					<button onclick={onPrev} disabled={!hasPrev} class="btn btn-secondary btn-sm">
						&larr; {t('focus.prev')}
					</button>
					{#if hasNext}
						<button onclick={onNext} class="btn btn-primary btn-sm">
							{t('focus.next')} &rarr;
						</button>
					{:else}
						<!-- Конец повестки: вместо задизейбленной «Далее» — завершение
						     прямо под рукой, а не малозаметная кнопка в шапке итогов -->
						<button onclick={onStop} class="btn btn-primary btn-sm">
							{t('focus.stop')}
						</button>
					{/if}
				{/if}
				<span class="ml-auto flex">{@render commentPill()}</span>
			</div>
		{/if}

		<!-- pointer-events-auto: иначе во время обсуждения клик по форме комментария
		     проваливался бы в слой прыжка и переводил фокус вместо ввода текста -->
		<div class="pointer-events-auto">
			<CommentList cardId={card.id} {expanded} />
		</div>
	</div>
</div>
