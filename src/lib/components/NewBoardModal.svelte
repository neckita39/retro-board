<script lang="ts">
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let {
		spaceSlug,
		spaceName,
		suggestedTitle = '',
		suggestedFrom = null,
		onClose
	}: {
		spaceSlug: string;
		spaceName: string;
		suggestedTitle?: string;
		suggestedFrom?: string | null;
		onClose: () => void;
	} = $props();

	// The modal is remounted on every open, so capturing the initial suggestion is intended
	// svelte-ignore state_referenced_locally
	let title = $state(suggestedTitle);
	let inputRef = $state<HTMLInputElement | null>(null);

	$effect(() => {
		inputRef?.focus();
		inputRef?.select();
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="modal-overlay-enter fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(33,30,26,0.35)] p-4"
	onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
	<div
		class="modal-card-enter flex w-[480px] max-w-full flex-col gap-[18px] rounded-[20px] bg-surface-card p-6 shadow-[0_32px_80px_rgba(33,30,26,0.35)] sm:p-8"
		role="dialog"
		aria-modal="true"
		aria-label={t('space.boards.create')}
	>
		<div class="flex items-start justify-between gap-3">
			<div class="flex flex-col gap-1.5">
				<h3 class="font-heading text-[22px] font-bold text-text-primary">{t('space.boards.create')}</h3>
				<p class="text-sm text-text-secondary">{t('space.modal.context', { name: spaceName })}</p>
			</div>
			<button
				onclick={onClose}
				class="btn-icon btn-icon-lg btn-icon-bordered shrink-0"
				aria-label={t('card.cancel')}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
			</button>
		</div>

		<form method="POST" action="/spaces/{spaceSlug}?/createBoard" class="flex flex-col gap-[18px]">
			<input type="hidden" name="locale" value={localeStore.locale} />
			<label class="flex flex-col gap-2">
				<span class="text-sm font-semibold text-text-primary">{t('space.modal.name')}</span>
				<input
					bind:this={inputRef}
					type="text"
					name="title"
					maxlength="100"
					bind:value={title}
					placeholder={t('space.boards.create.placeholder')}
					class="input h-[50px] bg-surface px-4 text-base"
				/>
			</label>
			{#if suggestedFrom && title === suggestedTitle && suggestedTitle}
				<p class="text-[13px] leading-relaxed text-text-muted">{t('space.modal.hint.auto', { title: suggestedFrom })}</p>
			{:else}
				<p class="text-[13px] leading-relaxed text-text-muted">{t('space.modal.hint')}</p>
			{/if}
			<div class="flex gap-2.5">
				<button type="button" onclick={onClose} class="btn btn-secondary h-[50px] flex-1 rounded-[14px] text-[15px]">
					{t('card.cancel')}
				</button>
				<button type="submit" class="btn btn-primary h-[50px] flex-[2] rounded-[14px] text-[15px]">
					{t('new.board.submit')}
				</button>
			</div>
		</form>
	</div>
</div>
