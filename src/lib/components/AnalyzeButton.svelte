<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// compact: на узких экранах остаётся только иконка (как у «Поделиться»)
	let { spaceSlug, compact = false }: { spaceSlug: string; compact?: boolean } = $props();

	let busy = $state(false);
	let error = $state<{ kind: string; hours: number } | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	function showError(kind: string, hours = 0) {
		error = { kind, hours };
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (error = null), 8000);
	}
</script>

<form
	method="POST"
	action="/spaces/{spaceSlug}?/analyze"
	class="contents"
	use:enhance={() => {
		busy = true;
		error = null;
		return async ({ result }) => {
			busy = false;
			if (result.type === 'redirect') {
				await goto(result.location, { invalidateAll: true });
			} else if (result.type === 'failure') {
				const data = (result.data ?? {}) as { analysis?: string; retryInHours?: number };
				showError(data.analysis ?? 'network', data.retryInHours ?? 0);
			} else if (result.type === 'error') {
				showError('network');
			}
		};
	}}
>
	<input type="hidden" name="locale" value={localeStore.locale} />
	<button
		type="submit"
		disabled={busy}
		class="btn btn-ai btn-md"
		title={t('space.analysis.button')}
		aria-label={t('space.analysis.button')}
		data-testid="analyze-button"
	>
		{#if busy}
			<svg class="h-[15px] w-[15px] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
		{:else}
			<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>
		{/if}
		<span class={compact ? 'hidden sm:inline' : ''}>{t('space.analysis.button')}</span>
	</button>
</form>

{#if busy || error}
	<div
		role="status"
		class="card-enter fixed bottom-5 left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-border bg-surface-card px-4 py-3 text-sm shadow-lg {error ? 'text-bad' : 'text-text-secondary'}"
		data-testid="analyze-status"
	>
		{#if error}
			{t(`space.analysis.error.${error.kind}`, { n: error.hours })}
		{:else}
			{t('space.analysis.running')}
		{/if}
	</div>
{/if}
