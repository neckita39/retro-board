<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	boardStore.board = null;

	let joinOpen = $state(false);
	let joinValue = $state('');

	function goToBoard() {
		const raw = joinValue.trim();
		if (!raw) return;
		// Extract slug from full URL or use as-is
		const slug = raw.includes('/') ? raw.split('/').filter(Boolean).pop() : raw;
		if (slug) window.location.href = `/${slug}`;
	}
</script>

<svelte:head>
	<title>{t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="flex flex-1 items-center justify-center p-4">
		<div class="w-full max-w-md space-y-8 text-center">
			<div class="flex justify-center">
				<img src="/logo.png" alt="Retrospectrix" width="96" height="96" class="dark:invert" />
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

			<div class="space-y-3">
				{#if !joinOpen}
					<button
						onclick={() => (joinOpen = true)}
						class="text-sm text-text-muted transition-colors hover:text-text-secondary"
					>
						{t('home.join')}
					</button>
				{:else}
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={joinValue}
							placeholder={t('home.join.placeholder')}
							onkeydown={(e) => e.key === 'Enter' && goToBoard()}
							class="flex-1 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
						/>
						<button
							onclick={goToBoard}
							class="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
						>
							{t('home.join.button')}
						</button>
					</div>
				{/if}
			</div>

			<p class="text-xs text-text-muted">
				{t('home.note')}
			</p>
		</div>
	</main>
</div>
