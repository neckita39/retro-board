<script lang="ts">
	import { t } from '$lib/i18n/index.js';

	let { error = '' }: { error?: string } = $props();
</script>

<div class="w-full max-w-sm space-y-6 text-center">
	<div class="space-y-2">
		<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-text-muted">
			<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
			<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
		</svg>
		<h1 class="text-xl font-bold text-text-primary">{t('space.password.title')}</h1>
	</div>

	<form method="POST" action="?/verify" class="space-y-3">
		<div>
			<input
				type="password"
				name="password"
				placeholder={t('space.password.placeholder')}
				required
				maxlength="100"
				class="w-full rounded-xl border bg-surface-card px-4 py-3 text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 {error ? 'border-red-400 focus:border-red-400 focus:ring-red-200 dark:focus:ring-red-900/40' : 'border-border focus:border-border-strong focus:ring-border'}"
			/>
			{#if error}
				<p class="mt-1.5 text-xs text-red-500">{error}</p>
			{/if}
		</div>
		<button
			type="submit"
			class="w-full rounded-xl bg-text-primary px-4 py-3 font-medium text-surface transition-opacity hover:opacity-90"
		>
			{t('space.password.button')}
		</button>
	</form>
</div>
