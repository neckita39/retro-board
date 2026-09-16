<script lang="ts">
	import CardComponent from './Card.svelte';
	import CardForm from './CardForm.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { dndStore } from '$lib/stores/dnd.svelte.js';
	import { TONE } from '$lib/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	let { column }: { column: string } = $props();

	let def = $derived(boardStore.columnDef(column));
	let tone = $derived(TONE[def.tone]);

	let sortBy = $state<'newest' | 'votes'>('newest');

	let columnCards = $derived(boardStore.getColumnCards(column, sortBy));

	// Тащат карточку из другой колонки — мы валидная цель для дропа
	let isDropTarget = $derived(dndStore.cardId !== null && dndStore.from !== column);
	let dragOver = $state(false);

	function handleDragOver(e: DragEvent) {
		if (!isDropTarget) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		// Переход на дочерний элемент — это не уход из колонки
		if (
			e.currentTarget instanceof HTMLElement &&
			e.relatedTarget instanceof Node &&
			e.currentTarget.contains(e.relatedTarget)
		)
			return;
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (dndStore.cardId && dndStore.from !== column) {
			socketStore.moveCard(dndStore.cardId, column);
		}
		dndStore.end();
	}

</script>

<div
	data-testid="column"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="group"
	class="flex h-full flex-col gap-3 rounded-2xl outline-2 outline-offset-4 transition-[background-color,outline-color] duration-200 {isDropTarget
		? dragOver
			? `outline-solid ${tone.outline}`
			: 'outline-dashed outline-border-strong'
		: 'outline-transparent'}"
>
	<!-- Column header — title underlined with the column color -->
	<div class="flex items-baseline gap-2.5 border-b-[3px] pb-2.5 {tone.border}">
		<h2 class="font-heading text-[21px] font-bold leading-[1.2] text-text-primary">
			{txt(def.title)}
		</h2>
		<span class="text-sm font-semibold tabular-nums {tone.text}">{columnCards.length}</span>
		<button
			onclick={() => (sortBy = sortBy === 'newest' ? 'votes' : 'newest')}
			class="btn-icon btn-icon-sm ml-auto self-center {sortBy === 'votes' ? 'text-text-primary' : ''}"
			aria-label={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			title={sortBy === 'votes' ? t('column.sort.newest') : t('column.sort.votes')}
			aria-pressed={sortBy === 'votes'}
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
		</button>
	</div>

	<!-- Add card — always visible on top; the mobile composer lives at the bottom of the screen -->
	<div class="hidden md:block">
		<CardForm {column} />
	</div>

	<div class="flex flex-col gap-3" role="list">
		{#each columnCards as card, i (card.id)}
			<div role="listitem" style="animation: cardEnter 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) {i * 0.05}s both;">
				<CardComponent {card} />
			</div>
		{/each}
	</div>
</div>
