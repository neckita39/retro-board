<script lang="ts">
	import { enhance } from '$app/forms';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// header: кнопка в шапке (compact — на узких экранах только иконка);
	// retry: маленькая кнопка «Повторить» в плитке упавшего анализа.
	// Сервер отвечает сразу: задача идёт в фоне, «запущен / готов / ошибка»
	// приходят всем по сокету. Здесь только локальные ответы action.
	let {
		spaceSlug,
		compact = false,
		variant = 'header'
	}: { spaceSlug: string; compact?: boolean; variant?: 'header' | 'retry' } = $props();

	let busy = $state(false);

	// Календарная дата нажавшего для названия «Анализ пространства за …»:
	// вечером в Москве по UTC ещё вчера
	function localDate(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}
</script>

<form
	method="POST"
	action="/spaces/{spaceSlug}?/analyze"
	class="contents"
	use:enhance={({ formData }) => {
		busy = true;
		formData.set('localDate', localDate());
		return async ({ result }) => {
			busy = false;
			if (result.type === 'success') {
				const data = (result.data ?? {}) as { analysis?: string; boardSlug?: string };
				if (data.analysis === 'cached' && data.boardSlug) {
					toastStore.push({
						kind: 'info',
						text: t('space.analysis.toast.cached'),
						action: { label: t('space.analysis.toast.open'), href: `/${data.boardSlug}` }
					});
				}
			} else if (result.type === 'failure') {
				const data = (result.data ?? {}) as { analysis?: string; retryInHours?: number };
				toastStore.push({
					kind: 'error',
					text: t(`space.analysis.error.${data.analysis ?? 'network'}`, { n: data.retryInHours ?? 0 })
				});
			} else if (result.type === 'error') {
				toastStore.push({ kind: 'error', text: t('space.analysis.error.network') });
			}
		};
	}}
>
	<input type="hidden" name="locale" value={localeStore.locale} />
	{#if variant === 'retry'}
		<button type="submit" disabled={busy} class="btn btn-secondary btn-sm" data-testid="analyze-retry">
			{t('space.analysis.tile.retry')}
		</button>
	{:else}
		<button
			type="submit"
			disabled={busy}
			class="btn btn-ai btn-md"
			title={t('space.analysis.button')}
			aria-label={t('space.analysis.button')}
			data-testid="analyze-button"
		>
			<svg class="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/></svg>
			<span class={compact ? 'hidden sm:inline' : ''}>{t('space.analysis.button')}</span>
		</button>
	{/if}
</form>
