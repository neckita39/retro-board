<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { browser } from '$app/environment';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { column, variant = 'column' }: { column: ColumnType; variant?: 'column' | 'composer' } = $props();

	let content = $state('');
	let expanded = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	let imageId = $state<string | null>(null);
	let imagePreview = $state<string | null>(null);
	let uploading = $state(false);
	let uploadError = $state('');
	let fileInputRef = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (expanded && textareaRef) {
			textareaRef.focus();
		}
	});

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			uploadError = t('image.invalid');
			return;
		}

		uploadError = '';
		imagePreview = URL.createObjectURL(file);
		uploading = true;

		try {
			const formData = new FormData();
			formData.append('image', file);
			const res = await fetch('/api/upload', { method: 'POST', body: formData });
			if (!res.ok) throw new Error();
			const data = await res.json();
			imageId = data.imageId;
		} catch {
			uploadError = t('image.error');
			imagePreview = null;
			imageId = null;
		} finally {
			uploading = false;
			if (input) input.value = '';
		}
	}

	function removeImage() {
		imageId = null;
		if (imagePreview) {
			URL.revokeObjectURL(imagePreview);
			imagePreview = null;
		}
		uploadError = '';
	}

	function submit() {
		const text = content.trim();
		if (!text && !imageId) return;
		if (!boardStore.board) return;
		const authorName = browser ? localStorage.getItem('retro_name') || '' : '';
		socketStore.createCard(boardStore.board.id, column, text, authorName || undefined, imageId || undefined);
		content = '';
		removeImage();
		expanded = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
		if (e.key === 'Escape') {
			expanded = false;
			content = '';
			removeImage();
		}
	}
</script>

{#snippet imagePreviewBlock()}
	{#if imagePreview}
		<div class="relative inline-block">
			<img src={imagePreview} alt="" class="max-h-24 rounded-lg border border-border object-contain {uploading ? 'opacity-40' : ''}" />
			{#if uploading}
				<div class="absolute inset-0 flex items-center justify-center">
					<svg class="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
						<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
						<path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
					</svg>
				</div>
			{/if}
			<button
				type="button"
				onclick={removeImage}
				class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-white shadow-sm"
				aria-label={t('image.remove')}
			>
				<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
	{/if}
	{#if uploadError}
		<div class="error-box error-box-sm">
			<svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			<span>{uploadError}</span>
		</div>
	{/if}
{/snippet}

<input bind:this={fileInputRef} type="file" accept="image/*" onchange={handleFileSelect} class="hidden" />

{#if variant === 'composer'}
	<!-- Mobile composer — pinned to the bottom like a messenger input -->
	<div class="flex flex-col gap-2">
		{@render imagePreviewBlock()}
		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="flex items-center gap-2.5">
			<button
				type="button"
				onclick={() => fileInputRef?.click()}
				class="flex h-12 w-11 shrink-0 items-center justify-center rounded-[14px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
				title={t('image.attach')}
				aria-label={t('image.attach')}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
				</svg>
			</button>
			<input
				type="text"
				bind:value={content}
				onkeydown={handleKeydown}
				placeholder={t('card.addCard')}
				maxlength="2000"
				class="h-12 min-w-0 flex-1 rounded-[14px] border border-border bg-surface px-4 text-[15px] text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none"
			/>
			<button
				type="submit"
				disabled={!content.trim() && !imageId}
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent text-white transition-colors hover:bg-accent-hover active:scale-95 disabled:opacity-50"
				aria-label={t('card.add')}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
			</button>
		</form>
	</div>
{:else if expanded}
	<form
		onsubmit={(e) => { e.preventDefault(); submit(); }}
		class="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-text-primary bg-surface-card p-3.5"
		style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;"
	>
		<textarea
			bind:this={textareaRef}
			bind:value={content}
			onkeydown={handleKeydown}
			placeholder={t('card.placeholder')}
			maxlength="2000"
			class="w-full resize-none border-none bg-transparent text-[15px] leading-normal text-text-primary placeholder:text-text-muted focus:outline-none"
			rows="3"
		></textarea>

		{@render imagePreviewBlock()}

		<div class="flex items-center justify-between">
			<button
				type="button"
				onclick={() => fileInputRef?.click()}
				class="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
				title={t('image.attach')}
				aria-label={t('image.attach')}
			>
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
				</svg>
			</button>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => { expanded = false; content = ''; removeImage(); }}
					class="btn btn-secondary btn-sm"
				>
					{t('card.cancel')}
				</button>
				<button
					type="submit"
					disabled={!content.trim() && !imageId}
					class="btn btn-primary btn-sm"
				>
					{t('card.add')}
				</button>
			</div>
		</div>
	</form>
{:else}
	<!-- Always visible "Add card…" affordance at the top of the column -->
	<button
		onclick={() => (expanded = true)}
		class="flex w-full items-center gap-2.5 rounded-[14px] border border-border bg-surface-card px-4 py-3 text-left text-[15px] text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
		{t('card.addCard')}
	</button>
{/if}
