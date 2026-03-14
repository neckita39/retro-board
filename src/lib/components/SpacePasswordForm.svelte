<script lang="ts">
	import { t } from '$lib/i18n/index.js';
	import { enhance } from '$app/forms';

	let { spaceName, error: formError = '' }: { spaceName: string; error?: string } = $props();

	let shaking = $state(false);

	function handleSubmit() {
		return async ({ result, update }: any) => {
			if (result.type === 'failure') {
				shaking = true;
				setTimeout(() => (shaking = false), 600);
			}
			await update();
		};
	}
</script>

<div class="flex flex-1 items-center justify-center p-6">
	<div class="card-enter w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 text-center shadow-lg">
		<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors
			{formError ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950' : 'border-border bg-surface-hover'}">
			<svg class="h-5 w-5 transition-colors {formError ? 'text-red-500' : 'text-text-muted'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<rect width="18" height="11" x="3" y="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		</div>
		<h2 class="text-lg font-bold text-text-primary">{spaceName}</h2>
		<p class="mt-1 text-sm text-text-secondary">{t('space.password.title')}</p>

		<form method="POST" action="?/verify" use:enhance={handleSubmit} class="mt-5 space-y-3">
			<input
				type="password"
				name="password"
				required
				maxlength="100"
				placeholder={t('space.password.placeholder')}
				class="w-full rounded-lg border px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:ring-2
					{formError ? 'border-red-400 focus:ring-red-200 dark:border-red-700 dark:focus:ring-red-900/30' : 'border-border bg-surface focus:border-text-primary focus:ring-border'}
					{shaking ? 'animate-[shake_0.5s_ease]' : ''}"
			/>
			{#if formError}
				<p class="text-left text-xs text-red-500 animate-[shake_0.5s_ease]">
					{t('space.password.error')}
				</p>
			{/if}
			<button
				type="submit"
				class="w-full rounded-lg bg-text-primary px-4 py-3 text-sm font-semibold text-surface transition-opacity hover:opacity-85 active:scale-[0.98]"
			>
				{t('space.password.button')}
			</button>
		</form>
	</div>
</div>
