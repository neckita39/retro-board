<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	boardStore.board = null;

	let mode = $state<'board' | 'space'>('board');

	let joinOpen = $state(false);
	let joinValue = $state('');

	let spaceJoinOpen = $state(false);
	let spaceJoinValue = $state('');

	function goToBoard() {
		const raw = joinValue.trim();
		if (!raw) return;
		const slug = raw.includes('/') ? raw.split('/').filter(Boolean).pop() : raw;
		if (slug) window.location.href = `/${slug}`;
	}

	function goToSpace() {
		const raw = spaceJoinValue.trim();
		if (!raw) return;
		const slug = raw.includes('/') ? raw.split('/').filter(Boolean).pop() : raw;
		if (slug) window.location.href = `/spaces/${slug}`;
	}
</script>

<svelte:head>
	<title>{t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="flex flex-1 items-center justify-center p-4">
		<div class="w-full max-w-md space-y-6 text-center">
			<div class="flex justify-center">
				<img src="/logo.png" alt="Retrospectrix" width="64" height="64" class="dark:invert" />
			</div>

			<!-- Tab switcher -->
			<div class="flex rounded-xl border border-border bg-surface-card p-1">
				<button
					onclick={() => (mode = 'board')}
					class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {mode === 'board'
						? 'bg-text-primary text-surface'
						: 'text-text-muted hover:text-text-secondary'}"
				>
					{t('home.create')}
				</button>
				<button
					onclick={() => (mode = 'space')}
					class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors {mode === 'space'
						? 'bg-text-primary text-surface'
						: 'text-text-muted hover:text-text-secondary'}"
				>
					{t('space.create')}
				</button>
			</div>

			{#if mode === 'board'}
				<div class="space-y-2">
					<h1 class="font-heading text-2xl font-bold tracking-tight text-text-primary">
						{t('home.title')}
					</h1>
					<p class="text-text-secondary">
						{t('home.subtitle')}
					</p>
				</div>

				<form method="POST" action="?/createBoard" class="space-y-2.5">
					<input
						type="text"
						name="title"
						maxlength="100"
						placeholder={t('home.placeholder')}
						class="w-full rounded-xl border border-border bg-surface-card px-4 py-3 text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
					/>
					<button
						type="submit"
						class="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
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
			{:else}
				<div class="space-y-2">
					<h1 class="font-heading text-2xl font-bold tracking-tight text-text-primary">
						{t('space.title')}
					</h1>
					<p class="text-text-secondary">
						{t('space.subtitle')}
					</p>
				</div>

				<form method="POST" action="?/createSpace" class="space-y-2.5">
					<input
						type="text"
						name="name"
						required
						maxlength="100"
						placeholder={t('space.create.name')}
						class="w-full rounded-xl border border-border bg-surface-card px-4 py-3 text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
					/>
					<input
						type="password"
						name="password"
						required
						minlength="1"
						maxlength="100"
						placeholder={t('space.create.password')}
						class="w-full rounded-xl border border-border bg-surface-card px-4 py-3 text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
					/>
					<button
						type="submit"
						class="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
					>
						{t('space.create.button')}
					</button>
				</form>

				<div class="space-y-3">
					{#if !spaceJoinOpen}
						<button
							onclick={() => (spaceJoinOpen = true)}
							class="text-sm text-text-muted transition-colors hover:text-text-secondary"
						>
							{t('space.join')}
						</button>
					{:else}
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={spaceJoinValue}
								placeholder={t('space.join.placeholder')}
								onkeydown={(e) => e.key === 'Enter' && goToSpace()}
								class="flex-1 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
							/>
							<button
								onclick={goToSpace}
								class="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
							>
								{t('space.join.button')}
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>
