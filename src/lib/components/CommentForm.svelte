<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.js';

	let { cardId }: { cardId: string } = $props();

	let content = $state('');
	let imageId = $state<string | null>(null);
	let imagePreview = $state<string | null>(null);
	let uploading = $state(false);
	let uploadError = $state('');
	let fileInputRef = $state<HTMLInputElement | null>(null);

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
		const authorName = browser ? localStorage.getItem('retro_name') || '' : '';
		socketStore.createComment(cardId, text, authorName || undefined, imageId || undefined);
		content = '';
		removeImage();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}
</script>

{#if imagePreview}
	<div class="relative mb-1 inline-block">
		<img src={imagePreview} alt="" class="max-h-16 rounded border border-border object-cover {uploading ? 'opacity-50' : ''}" />
		{#if uploading}
			<span class="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-text-secondary">{t('image.uploading')}</span>
		{/if}
		<button
			type="button"
			onclick={removeImage}
			class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
			aria-label={t('image.remove')}
		>
			<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
		</button>
	</div>
{/if}
{#if uploadError}
	<p class="mb-1 text-[10px] text-red-500">{uploadError}</p>
{/if}

<input bind:this={fileInputRef} type="file" accept="image/*" onchange={handleFileSelect} class="hidden" />

<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="flex gap-1.5">
	<button
		type="button"
		onclick={() => fileInputRef?.click()}
		class="flex-shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
		title={t('image.attach')}
	>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
		</svg>
	</button>
	<input
		type="text"
		bind:value={content}
		onkeydown={handleKeydown}
		maxlength="1000"
		placeholder={t('comment.placeholder')}
		class="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
	/>
	<button
		type="submit"
		disabled={!content.trim() && !imageId}
		class="rounded-md bg-text-primary px-2.5 py-1.5 text-xs font-medium text-surface transition-opacity disabled:opacity-30"
	>
		{t('comment.send')}
	</button>
</form>
