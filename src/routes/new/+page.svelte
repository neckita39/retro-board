<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { data } = $props();

	boardStore.board = null;

	// Only the initial URL decides the preselected tab — later switches are user-driven
	// svelte-ignore state_referenced_locally
	let mode = $state<'board' | 'space'>(data.type === 'space' ? 'space' : 'board');
	let passwordEnabled = $state(false);

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

{#snippet checkBadge()}
	<div class="absolute right-4 top-4 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent">
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
	</div>
{/snippet}

<div class="flex min-h-screen flex-col">
	<Header showNav />

	<main class="flex flex-1 justify-center px-4 pb-20 pt-10 sm:pt-14">
		<div class="flex w-full max-w-[720px] flex-col items-center gap-7">
			<div class="flex flex-col items-center gap-2.5 text-center">
				<h1 class="font-heading text-[26px] font-bold tracking-[-0.02em] text-text-primary sm:text-[32px]">
					{t('new.title')}
				</h1>
				<p class="text-base text-text-secondary">{t('new.subtitle')}</p>
			</div>

			<!-- Type choice — two large cards instead of a switch -->
			<div class="grid w-full gap-4 sm:grid-cols-2">
				<button
					onclick={() => (mode = 'board')}
					aria-pressed={mode === 'board'}
					class="relative flex flex-col gap-3 rounded-[18px] bg-surface-card p-6 text-left transition-all {mode === 'board'
						? 'outline outline-2 outline-accent shadow-[0_8px_24px_rgba(196,85,43,0.15)]'
						: 'border border-border hover:border-border-strong'}"
				>
					{#if mode === 'board'}{@render checkBadge()}{/if}
					<div class="flex gap-1.5" aria-hidden="true">
						<div class="h-[34px] w-3.5 rounded bg-well-bg"></div>
						<div class="h-[34px] w-3.5 rounded bg-bad-bg"></div>
						<div class="h-[34px] w-3.5 rounded bg-improve-bg"></div>
					</div>
					<span class="font-heading text-xl font-bold text-text-primary">{t('new.board.title')}</span>
					<p class="text-sm leading-relaxed text-text-secondary">{t('new.board.desc')}</p>
				</button>
				<button
					onclick={() => (mode = 'space')}
					aria-pressed={mode === 'space'}
					class="relative flex flex-col gap-3 rounded-[18px] bg-surface-card p-6 text-left transition-all {mode === 'space'
						? 'outline outline-2 outline-accent shadow-[0_8px_24px_rgba(196,85,43,0.15)]'
						: 'border border-border hover:border-border-strong'}"
				>
					{#if mode === 'space'}{@render checkBadge()}{/if}
					<div class="flex gap-1.5" aria-hidden="true">
						<div class="h-[34px] w-[34px] rounded-lg bg-surface-hover"></div>
						<div class="h-[34px] w-[34px] rounded-lg bg-surface-hover"></div>
						<div class="h-[34px] w-[34px] rounded-lg border-[1.5px] border-dashed border-border-strong"></div>
					</div>
					<span class="font-heading text-xl font-bold text-text-primary">{t('new.space.title')}</span>
					<p class="text-sm leading-relaxed text-text-secondary">{t('new.space.desc')}</p>
				</button>
			</div>

			{#key mode}
			<div class="flex w-full flex-col gap-3.5" style="animation: fadeUp 0.35s cubic-bezier(0.25, 1, 0.5, 1) both;">
			{#if mode === 'board'}
				<form method="POST" action="?/createBoard" class="flex flex-col gap-3.5">
					<input type="hidden" name="locale" value={localeStore.locale} />
					<label class="flex flex-col gap-2">
						<span class="text-sm font-semibold text-text-primary">{t('new.board.name')}</span>
						<input
							type="text"
							name="title"
							maxlength="100"
							placeholder={t('home.placeholder')}
							class="input input-lg"
						/>
					</label>
					<button type="submit" class="btn btn-primary btn-lg h-[54px] w-full">
						{t('new.board.submit')}
					</button>
					<p class="text-center text-[13px] text-text-muted">{t('new.board.note')}</p>
				</form>

				<div class="text-center">
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
								class="input input-md flex-1"
							/>
							<button onclick={goToBoard} class="btn btn-secondary btn-md">
								{t('home.join.button')}
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<form method="POST" action="?/createSpace" class="flex flex-col gap-3.5">
					<label class="flex flex-col gap-2">
						<span class="text-sm font-semibold text-text-primary">{t('new.space.name')}</span>
						<input
							type="text"
							name="name"
							required
							maxlength="100"
							placeholder={t('space.create.name')}
							class="input input-lg"
						/>
					</label>

					<!-- Password toggle -->
					<ToggleSwitch bind:checked={passwordEnabled} label={t('space.create.password.toggle')} />

					<div class="collapsible {passwordEnabled ? 'open' : ''}">
						<div>
							<input
								type="password"
								name="password"
								required={passwordEnabled}
								minlength="1"
								maxlength="100"
								placeholder={t('space.create.password')}
								class="input input-lg"
								tabindex={passwordEnabled ? 0 : -1}
							/>
						</div>
					</div>

					<button type="submit" class="btn btn-primary btn-lg h-[54px] w-full">
						{t('new.space.submit')}
					</button>
					<p class="text-center text-[13px] text-text-muted">{t('new.space.note')}</p>
				</form>

				<div class="text-center">
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
								class="input input-md flex-1"
							/>
							<button onclick={goToSpace} class="btn btn-secondary btn-md">
								{t('space.join.button')}
							</button>
						</div>
					{/if}
				</div>
			{/if}
			</div>
			{/key}
		</div>
	</main>
</div>
