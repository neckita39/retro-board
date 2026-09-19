<script lang="ts">
	import { t } from '$lib/i18n/index.js';
	import { enhance } from '$app/forms';

	// error — код ошибки экшена ('wrong_password' | 'too_many'), а не готовая строка:
	// переводит сама форма. next — слаг доски, на которую вернуть после пароля
	let {
		spaceName,
		error: formError = '',
		next = null
	}: { spaceName: string; error?: string; next?: string | null } = $props();

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
	<div class="card-enter card card-lg w-full max-w-sm text-center">
		<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-colors
			{formError ? 'border-bad bg-bad-bg' : 'border-border bg-surface-hover'}">
			<svg class="h-5 w-5 transition-colors {formError ? 'text-bad' : 'text-text-muted'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<rect width="18" height="11" x="3" y="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		</div>
		<h2 class="font-heading text-[21px] font-bold text-text-primary">{spaceName}</h2>
		<p class="mt-1 text-sm text-text-secondary">{t('space.password.title')}</p>

		<form method="POST" action="?/verify" use:enhance={handleSubmit} class="mt-5 space-y-3">
			{#if next}
				<input type="hidden" name="next" value={next} />
			{/if}
			<input
				type="password"
				name="password"
				required
				maxlength="100"
				placeholder={t('space.password.placeholder')}
				class="input input-lg
					{formError ? 'border-bad' : ''}
					{shaking ? 'animate-[shake_0.5s_ease]' : ''}"
			/>
			{#if formError}
				<p class="text-left text-[13px] text-bad animate-[shake_0.5s_ease]">
					{formError === 'too_many' ? t('space.password.tooMany') : t('space.password.error')}
				</p>
			{/if}
			<button
				type="submit"
				class="btn btn-dark btn-lg w-full"
			>
				{t('space.password.button')}
			</button>
		</form>
	</div>
</div>
