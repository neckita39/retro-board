<script lang="ts">
	import VoteButtons from './VoteButtons.svelte';
	import CommentList from './CommentList.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import type { Card, ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { card }: { card: Card } = $props();

	let editing = $state(false);
	let editContent = $state('');
	let moveOpen = $state(false);
	let deleteConfirming = $state(false);
	let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

	const ALL_COLUMNS: ColumnType[] = ['went_well', 'didnt_go_well', 'improve'];
	let otherColumns = $derived(ALL_COLUMNS.filter((c) => c !== card.columnType));

	const tagColors: Record<ColumnType, string> = {
		went_well: 'bg-well-bg text-well',
		didnt_go_well: 'bg-bad-bg text-bad',
		improve: 'bg-improve-bg text-improve'
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
			confirmTimeout = setTimeout(() => (deleteConfirming = false), 3000);
		}
	}
</script>

<div class="card-board card-interactive overflow-hidden hover:scale-[1.005]">
	<div class="flex items-start justify-between gap-2">
		{#if editing}
			<textarea
				bind:value={editContent}
				onkeydown={handleEditKeydown}
				onblur={saveEdit}
				maxlength="2000"
				class="flex-1 resize-none rounded border border-border bg-surface p-1.5 text-sm text-text-primary focus:border-border-strong focus:outline-none"
				rows="2"
			></textarea>
		{:else}
			{#if card.content}
				<p class="flex-1 text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap break-words">{card.content}</p>
			{:else}
				<div class="flex-1"></div>
			{/if}
			<div class="flex shrink-0 gap-0.5">
				<button
					onclick={() => (moveOpen = !moveOpen)}
					class="hover-reveal rounded p-1 text-text-muted transition-all hover:bg-surface-hover hover:text-text-secondary {moveOpen ? 'bg-surface-hover text-text-secondary opacity-100' : ''}"
					aria-label={t('card.move')}
					aria-expanded={moveOpen}
					title={t('card.move')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="17 11 21 7 17 3"/>
						<line x1="21" y1="7" x2="9" y2="7"/>
						<polyline points="7 21 3 17 7 13"/>
						<line x1="15" y1="17" x2="3" y2="17"/>
					</svg>
				</button>
				<button
					onclick={startEdit}
					class="hover-reveal rounded p-1 text-text-muted transition-all hover:bg-surface-hover hover:text-text-secondary"
					aria-label={t('card.edit')}
					title={t('card.edit')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button
					onclick={requestDelete}
					class="hover-reveal rounded p-1 transition-all {deleteConfirming
						? 'bg-red-500 text-white opacity-100 hover:bg-red-600'
						: 'text-text-muted hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30'}"
					aria-label={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
					title={deleteConfirming ? t('card.delete.confirm') : t('card.delete')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"/>
						<line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	{#if moveOpen}
		<div class="mt-2 flex flex-wrap items-center gap-1.5" style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;">
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
			class="mt-2 max-h-48 w-full cursor-zoom-in rounded-lg object-contain transition-transform hover:scale-[1.02]"
			onclick={() => lightboxStore.open(card.imageId!)}
		/>
	{/if}

	{#if card.authorName}
		<p class="mt-1 text-[11px] text-text-muted">— {card.authorName}</p>
	{/if}

	<div class="mt-2 flex items-center justify-between">
		<VoteButtons cardId={card.id} />
	</div>

	<CommentList cardId={card.id} />
</div>
