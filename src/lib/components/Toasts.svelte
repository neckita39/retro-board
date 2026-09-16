<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// Чья кнопка только что сработала: её подпись 2 секунды показывает «Скопировано!»
	let clickedId = $state<number | null>(null);
	let clickedTimer: ReturnType<typeof setTimeout> | undefined;

	async function runAction(toast: Toast) {
		await toast.action?.onClick?.();
		clickedId = toast.id;
		clearTimeout(clickedTimer);
		clickedTimer = setTimeout(() => {
			if (clickedId === toast.id) clickedId = null;
		}, 2000);
	}
</script>

<!-- Стопка уведомлений: правый верхний угол под шапкой (иначе закрывает её кнопки), стиль карточек сайта -->
<div class="pointer-events-none fixed right-4 top-[68px] z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5 sm:top-[76px]">
	{#each toastStore.toasts as toast (toast.id)}
		<div
			role={toast.kind === 'error' ? 'alert' : 'status'}
			data-testid="toast"
			data-kind={toast.kind}
			class="card-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-surface-card py-3 pl-4 pr-3 shadow-1"
		>
			<span
				class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full
					{toast.kind === 'success' ? 'bg-well-bg text-well-strong' : toast.kind === 'error' ? 'bg-bad-bg text-bad-strong' : 'bg-improve-bg text-improve-strong'}"
				aria-hidden="true"
			>
				{#if toast.kind === 'success'}
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
				{:else if toast.kind === 'error'}
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="0.6"/></svg>
				{:else}
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
				{/if}
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1.5">
				<p class="text-sm leading-[1.4] text-text-primary">{toast.text}</p>
				{#if toast.action?.href}
					<a
						href={toast.action.href}
						onclick={() => toastStore.dismiss(toast.id)}
						class="self-start text-[13px] font-bold text-accent hover:underline"
					>
						{toast.action.label} →
					</a>
				{:else if toast.action?.onClick}
					<button
						type="button"
						onclick={() => runAction(toast)}
						class="self-start text-[13px] font-bold text-accent hover:underline"
					>
						{clickedId === toast.id ? t('copy.copied') : `${toast.action.label} →`}
					</button>
				{/if}
			</div>
			<button
				onclick={() => toastStore.dismiss(toast.id)}
				class="btn-icon btn-icon-sm shrink-0 text-text-muted hover:text-text-primary"
				aria-label={t('toast.close')}
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
	{/each}
</div>
