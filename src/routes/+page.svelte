<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
</script>

<svelte:head>
	<title>{t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="flex flex-1 items-center justify-center p-4">
		<div class="w-full max-w-md space-y-8 text-center">
			<div class="flex justify-center">
				<img src="/logo.png" alt="Retrospectrix" width="64" height="64" class="dark:invert" />
			</div>

			<div class="space-y-2">
				<h1 class="text-3xl font-bold tracking-tight text-text-primary">
					{t('home.title')}
				</h1>
				<p class="text-text-secondary">
					{t('home.subtitle')}
				</p>
			</div>

			<form method="POST" class="space-y-4">
				<input
					type="text"
					name="title"
					placeholder={t('home.placeholder')}
					required
					class="w-full rounded-xl border border-border bg-surface-card px-4 py-3 text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
				/>
				<button
					type="submit"
					class="w-full rounded-xl bg-text-primary px-4 py-3 font-medium text-surface transition-opacity hover:opacity-90"
				>
					{t('home.create')}
				</button>
			</form>

			<p class="text-xs text-text-muted">
				{t('home.note')}
			</p>
		</div>
	</main>
</div>
