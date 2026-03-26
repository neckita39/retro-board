<script lang="ts">
	import { t } from '$lib/i18n/index.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';
</script>

{#if !feedbackStore.open}
	<button
		onclick={() => feedbackStore.show()}
		class="fixed bottom-5 right-5 z-[500] flex items-center gap-2 rounded-full bg-text-primary px-4 py-2.5 text-[13px] font-semibold text-surface shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-95 sm:px-5"
		title={t('feedback.link')}
		style="animation: fadeUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1s both;"
	>
		<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
		</svg>
		<span class="hidden sm:inline">{t('feedback.link')}</span>
	</button>
{/if}
