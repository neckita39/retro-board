<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { browser } from '$app/environment';
	import type { ColumnType } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	let { column }: { column: ColumnType } = $props();

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

{#if expanded}
	<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-2">
		<textarea
			bind:this={textareaRef}
			bind:value={content}
			onkeydown={handleKeydown}
			placeholder={t('card.placeholder')}
			maxlength="2000"
			class="w-full resize-none rounded-lg border border-border bg-surface-card p-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
			rows="3"
		></textarea>

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
					class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
					aria-label={t('image.remove')}
				>
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		{/if}
		{#if uploadError}
			<p class="text-xs text-red-500">{uploadError}</p>
		{/if}

		<input bind:this={fileInputRef} type="file" accept="image/*" onchange={handleFileSelect} class="hidden" />

		<div class="flex items-center justify-between">
			<button
				type="button"
				onclick={() => fileInputRef?.click()}
				class="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
				title={t('image.attach')}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
				</svg>
			</button>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => { expanded = false; content = ''; removeImage(); }}
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
				>
					{t('card.cancel')}
				</button>
				<button
					type="submit"
					disabled={!content.trim() && !imageId}
					class="rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface transition-opacity disabled:opacity-30"
				>
					{t('card.add')}
				</button>
			</div>
		</div>
	</form>
{:else}
	<button
		onclick={() => (expanded = true)}
		class="w-full rounded-xl border border-dashed border-border/60 py-2 text-[12px] text-text-muted transition-all hover:border-border-strong hover:text-text-secondary"
	>
		{t('card.addCard')}
	</button>
{/if}
