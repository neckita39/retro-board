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
			<!-- Retro icon: circular arrow (iteration) + play triangle (move forward) -->
			<div class="flex justify-center">
				<svg width="56" height="56" viewBox="0 0 56 56" fill="none" class="text-text-muted opacity-60">
					<!-- Outer ring -->
					<circle cx="28" cy="28" r="26" stroke="currentColor" stroke-width="2" />
					<!-- Play triangle -->
					<path d="M22 19 L37 28 L22 37Z" fill="currentColor" opacity="0.25" />
					<!-- Circular arrow: 270° clockwise from 9 o'clock to 6 o'clock -->
					<path d="M18 28 A10 10 0 1 1 28 38" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
					<!-- Arrowhead at arc end (28,38), pointing left -->
					<polyline points="32,35 28,38 32,41" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
				</svg>
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
