<script lang="ts">
	import { enhance } from '$app/forms';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// header: вторичная кнопка в шапке пространства (compact — на узких экранах только иконка);
	// menu: пункт меню «⋯» на доске; retry: маленькая кнопка «Повторить» в плитке упавшего анализа.
	// Сервер отвечает сразу: задача идёт в фоне, «запущен / готов / ошибка»
	// приходят всем по сокету. Здесь только локальные ответы action.
	let {
		spaceSlug,
		compact = false,
		variant = 'header',
		onSubmit = null
	}: {
		spaceSlug: string;
		compact?: boolean;
		variant?: 'header' | 'retry' | 'menu';
		/** Вызывается в момент отправки формы — меню доски закрывает себя */
		onSubmit?: (() => void) | null;
	} = $props();

	let busy = $state(false);

	// Календарная дата нажавшего для названия «Анализ пространства за …»:
	// вечером в Москве по UTC ещё вчера
	function localDate(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}
</script>

<!-- AI — семейство improve: звезда синяя, никаких градиентов -->
{#snippet star()}
	<svg class="h-4 w-4 shrink-0 text-improve" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
{/snippet}

<form
	method="POST"
	action="/spaces/{spaceSlug}?/analyze"
	class="contents"
	use:enhance={({ formData }) => {
		busy = true;
		formData.set('localDate', localDate());
		onSubmit?.();
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
	{:else if variant === 'menu'}
		<button
			type="submit"
			disabled={busy}
			class="dropdown-item disabled:pointer-events-none disabled:opacity-50"
			data-testid="analyze-button"
		>
			{@render star()}
			{t('space.analysis.button')}
		</button>
	{:else}
		<button
			type="submit"
			disabled={busy}
			class="btn btn-secondary btn-md"
			title={t('space.analysis.button')}
			aria-label={t('space.analysis.button')}
			data-testid="analyze-button"
		>
			{@render star()}
			<span class={compact ? 'hidden sm:inline' : ''}>{t('space.analysis.button')}</span>
		</button>
	{/if}
</form>
