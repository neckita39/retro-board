<script lang="ts">
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import type { Card, ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { card }: { card: Card } = $props();

	let editing = $state(false);
	let editContent = $state('');
	let moveOpen = $state(false);
	let commentsOpen = $state(false);
	let deleteConfirming = $state(false);
	let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

	const ALL_COLUMNS: ColumnType[] = ['went_well', 'didnt_go_well', 'improve'];
	let otherColumns = $derived(ALL_COLUMNS.filter((c) => c !== card.columnType));

	let commentCount = $derived(boardStore.getCardComments(card.id).length);

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well-strong',
		didnt_go_well: 'bg-bad-bg text-bad-strong',
		improve: 'bg-improve-bg text-improve-strong'
	};

	function startEdit() {
		editContent = card.content;
		editing = true;
	}

	function saveEdit() {
		const text = editContent.trim();
		if (text && text !== card.content) {
			socketStore.updateCard(card.id, text);
		}
		editing = false;
	}

	function cancelEdit() {
		editing = false;
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') cancelEdit();
	}

	function moveTo(col: ColumnType) {
		socketStore.moveCard(card.id, col);
		moveOpen = false;
	}

	function requestDelete() {
		if (deleteConfirming) {
			if (confirmTimeout) clearTimeout(confirmTimeout);
			confirmTimeout = null;
			deleteConfirming = false;
			socketStore.deleteCard(card.id);
		} else {
			deleteConfirming = true;
			confirmTimeout = setTimeout(() => {
				deleteConfirming = false;
				confirmTimeout = null;
			}, 3000);
		}
	}
</script>

<div class="card-board card-interactive overflow-hidden">
	{#if editing}
		<textarea
			bind:value={editContent}
			onkeydown={handleEditKeydown}
			onblur={saveEdit}
			maxlength="2000"
			class="w-full resize-none rounded-[10px] border border-border bg-surface p-2 text-[15px] leading-normal text-text-primary focus:border-text-primary focus:outline-none"
			rows="2"
		></textarea>
	{:else}
		<div class="flex items-start justify-between gap-2">
			{#if card.content}
				<p class="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-[1.5] text-text-primary max-md:text-base">{card.content}</p>
			{:else}
				<div class="flex-1"></div>
			{/if}
			<!-- Card actions — always visible, no hover reveal -->
			<div class="flex shrink-0 gap-0.5">
				<button
					onclick={() => (moveOpen = !moveOpen)}
					class="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary {moveOpen ? 'bg-surface-hover text-text-secondary' : ''}"
					aria-label={t('card.move')}
					aria-expanded={moveOpen}
					title={t('card.move')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="17 11 21 7 17 3"/>
						<line x1="21" y1="7" x2="9" y2="7"/>
						<polyline points="7 21 3 17 7 13"/>
						<line x1="15" y1="17" x2="3" y2="17"/>
					</svg>
				</button>
				<button
					onclick={startEdit}
					class="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
					aria-label={t('card.edit')}
					title={t('card.edit')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button
					onclick={requestDelete}
					class="rounded-md p-1 transition-colors {deleteConfirming
						? 'bg-bad text-white hover:opacity-85'
						: 'text-text-muted hover:bg-bad-bg hover:text-bad'}"
					aria-label={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
					title={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	{#if moveOpen}
		<div class="mt-3 flex flex-wrap items-center gap-1.5" style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;">
			<span class="text-[11px] text-text-muted">{t('card.move')}:</span>
			{#each otherColumns as col (col)}
				<button onclick={() => moveTo(col)} class="badge-sm {tagColors[col]} transition-transform hover:scale-105">
					{t(`column.${col}`)}
				</button>
			{/each}
		</div>
	{/if}

	{#if card.imageId}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img
			src="/api/image/{card.imageId}"
			alt=""
			width={card.imageWidth || undefined}
			height={card.imageHeight || undefined}
			style={card.imageWidth && card.imageHeight ? `aspect-ratio: ${card.imageWidth}/${card.imageHeight}` : ''}
			class="mt-3 max-h-48 w-full cursor-zoom-in rounded-[10px] object-contain transition-transform hover:scale-[1.02]"
			onclick={() => lightboxStore.open(card.imageId!)}
		/>
	{/if}

	<!-- Action row — votes, comments and author, always visible -->
	<div class="mt-3 flex items-center gap-2">
		<VoteButtons cardId={card.id} />
		<button
			onclick={() => (commentsOpen = !commentsOpen)}
			aria-expanded={commentsOpen}
			aria-label={commentCount > 0 ? t('comment.count', { n: commentCount }) : t('comment.add')}
			class="pill max-md:px-3 max-md:py-2 !font-semibold {commentCount > 0
				? 'bg-accent-bg text-accent hover:opacity-85'
				: 'text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
		>
			{#key commentCount}
				<span class="flex items-center gap-1.5 {commentCount > 0 ? 'badge-pop' : ''}">
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill={commentCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					{#if commentCount > 0}{commentCount}{:else}{t('comment.add')}{/if}
				</span>
			{/key}
		</button>
		{#if card.authorName}
			<span class="ml-auto min-w-0 truncate text-[13px] text-text-muted">{card.authorName}</span>
		{/if}
	</div>

	<CommentList cardId={card.id} expanded={commentsOpen} />
</div>
