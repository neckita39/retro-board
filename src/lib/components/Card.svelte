<script lang="ts">
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import { dndStore } from '$lib/stores/dnd.svelte.js';
	import type { Card, ColumnType } from '$lib/types.js';
	import { TONE } from '$lib/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	let { card }: { card: Card } = $props();

	let editing = $state(false);
	let editContent = $state('');
	let moveOpen = $state(false);
	let commentsOpen = $state(false);
	let deleteConfirming = $state(false);
	let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

	let otherColumns = $derived(boardStore.columns.filter((c) => c.id !== card.columnType));

	let commentCount = $derived(boardStore.getCardComments(card.id).length);

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

	function handleEditBlur() {
		// Blur из-за потери фокуса самим окном (переключение раскладки
		// Win+Space / Cmd+Space, alt-tab) — пользователь ещё пишет, не сохраняем
		if (!document.hasFocus()) return;
		saveEdit();
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') cancelEdit();
	}

	let dragging = $derived(dndStore.cardId === card.id);

	function handleDragStart(e: DragEvent) {
		if (editing) {
			e.preventDefault();
			return;
		}
		dndStore.start(card.id, card.columnType);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', card.id);
		}
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

<div
	role="article"
	draggable={!editing}
	ondragstart={handleDragStart}
	ondragend={() => dndStore.end()}
	class="card-board card-interactive overflow-hidden transition-[opacity,transform] duration-200 {editing
		? ''
		: 'cursor-grab active:cursor-grabbing'} {dragging ? 'rotate-1 scale-[0.97] opacity-40' : ''}"
>
	{#if editing}
		<textarea
			bind:value={editContent}
			onkeydown={handleEditKeydown}
			onblur={handleEditBlur}
			maxlength="2000"
			class="textarea bg-surface px-3 py-2"
			rows="2"
		></textarea>
	{:else}
		<div class="flex items-start justify-between gap-2">
			{#if card.content}
				<p class="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-[1.5] text-text-primary">{card.content}</p>
			{:else}
				<div class="flex-1"></div>
			{/if}
			<!-- Действия всегда видны, без появления по ховеру. Кнопки 28px вылезают
			     на 6px за паддинг карточки, чтобы глифы стояли вровень с первой строкой -->
			<div class="-mr-1.5 -mt-1.5 flex shrink-0 gap-0.5">
				<button
					onclick={() => (moveOpen = !moveOpen)}
					class="btn-icon btn-icon-sm {moveOpen ? 'bg-surface-hover text-text-primary' : ''}"
					aria-label={t('card.move')}
					aria-expanded={moveOpen}
					title={t('card.move')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="17 11 21 7 17 3"/>
						<line x1="21" y1="7" x2="9" y2="7"/>
						<polyline points="7 21 3 17 7 13"/>
						<line x1="15" y1="17" x2="3" y2="17"/>
					</svg>
				</button>
				<button
					onclick={startEdit}
					class="btn-icon btn-icon-sm"
					aria-label={t('card.edit')}
					title={t('card.edit')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 20h9"/>
						<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
					</svg>
				</button>
				<button
					onclick={requestDelete}
					class="btn-icon btn-icon-sm {deleteConfirming
						? 'bg-bad text-white hover:bg-bad hover:text-white hover:opacity-85'
						: 'hover:bg-bad-bg hover:text-bad'}"
					aria-label={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
					title={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	{#if moveOpen}
		<div class="mt-3 flex flex-wrap items-center gap-1.5" style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;">
			<span class="text-[13px] text-text-muted">{t('card.move')}:</span>
			{#each otherColumns as col (col.id)}
				<button onclick={() => moveTo(col.id)} class="badge-sm {TONE[col.tone].badge} transition-transform hover:scale-105">
					{txt(col.title)}
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
			class="mt-3 max-h-48 w-full cursor-zoom-in rounded-lg object-contain transition-transform hover:scale-[1.02]"
			onclick={() => lightboxStore.open(card.imageId!)}
		/>
	{/if}

	<!-- Ряд действий — голоса, комментарии и автор, всегда видны.
	     Счётчик комментариев — нейтральная заливка: это состояние, а не действие,
	     терракота остаётся кнопкам и таймеру. На телефоне пилюли выше ради тача -->
	<div class="mt-3 flex items-center gap-2">
		<VoteButtons cardId={card.id} />
		<button
			onclick={() => (commentsOpen = !commentsOpen)}
			aria-expanded={commentsOpen}
			aria-label={commentCount > 0 ? t('comment.count', { n: commentCount }) : t('comment.add')}
			class="pill max-md:h-10 {commentCount > 0
				? 'pill-neutral hover:opacity-85'
				: 'font-semibold text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
		>
			{#key commentCount}
				<span class="flex items-center gap-1.5 {commentCount > 0 ? 'badge-pop' : ''}">
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
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
