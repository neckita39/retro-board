<script lang="ts">
	import { lightboxStore } from '$lib/stores/lightbox.svelte.js';
	import { t } from '$lib/i18n/index.js';

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') lightboxStore.close();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) lightboxStore.close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if lightboxStore.imageId}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={handleBackdropClick}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
		style="animation: lightboxFadeIn 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;"
	>
		<button
			onclick={() => lightboxStore.close()}
			class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
			aria-label={t('lightbox.close')}
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
		<img
			src="/api/image/{lightboxStore.imageId}"
			alt=""
			class="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
			style="animation: lightboxZoomIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;"
		/>
	</div>
{/if}
