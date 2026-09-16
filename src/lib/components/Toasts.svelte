<script lang="ts">
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';
</script>

<!-- Стопка уведомлений: правый верхний угол, стиль карточек сайта -->
<div class="pointer-events-none fixed right-4 top-4 z-[700] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5" aria-live="polite">
	{#each toastStore.toasts as toast (toast.id)}
		<div
			role={toast.kind === 'error' ? 'alert' : 'status'}
			data-testid="toast"
			data-kind={toast.kind}
			class="card-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-surface-card px-4 py-3 shadow-xl"
		>
			<span
				class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full
					{toast.kind === 'success' ? 'bg-well-bg text-well-strong' : toast.kind === 'error' ? 'bg-bad-bg text-bad-strong' : 'badge-ai'}"
				aria-hidden="true"
			>
				{#if toast.kind === 'success'}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
				{:else if toast.kind === 'error'}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="0.6"/></svg>
				{:else}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
				{/if}
			</span>
			<div class="flex min-w-0 flex-1 flex-col gap-1.5">
				<p class="text-[13.5px] leading-snug text-text-primary">{toast.text}</p>
				{#if toast.action}
					<a
						href={toast.action.href}
						onclick={() => toastStore.dismiss(toast.id)}
						class="self-start text-[13px] font-bold text-accent hover:underline"
					>
						{toast.action.label} →
					</a>
				{/if}
			</div>
			<button
				onclick={() => toastStore.dismiss(toast.id)}
				class="btn-icon shrink-0 text-text-muted hover:text-text-primary"
				aria-label={t('toast.close')}
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>
	{/each}
</div>
