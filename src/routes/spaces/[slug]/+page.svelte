<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import AdminBanner from '$lib/components/AdminBanner.svelte';
	import SpacePasswordForm from '$lib/components/SpacePasswordForm.svelte';
	import SpaceBoardGrid from '$lib/components/SpaceBoardGrid.svelte';
	import NewBoardModal from '$lib/components/NewBoardModal.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { data, form } = $props();

	boardStore.board = null;

	// Reload boards on any navigation to this page (back button, link, etc.)
	afterNavigate(({ from }) => {
		if (from) invalidateAll();
	});

	// Handle browser bfcache restoration (back button after redirect)
	if (browser) {
		window.addEventListener('pageshow', (e) => {
			if (e.persisted) invalidateAll();
		});
	}

	let creating = $state(false);
	let deleteConfirming = $state(false);
	let passwordOpen = $state(false);
	let passwordShaking = $state(false);
	let passwordSuccess = $state('');

	// createdAt is only present once the space password has been entered
	let spaceCreatedAt = $derived('createdAt' in data.space ? data.space.createdAt : null);

	// Prefill the next sprint name: increment the trailing number of the latest board title
	let latestTitle = $derived(data.boards[0]?.title ?? null);
	let suggestedTitle = $derived.by(() => {
		if (!latestTitle) return '';
		const match = latestTitle.match(/(\d+)(?=\D*$)/);
		if (!match) return '';
		const next = String(Number(match[1]) + 1);
		return latestTitle.slice(0, match.index) + next + latestTitle.slice(match.index! + match[1].length);
	});

	$effect(() => {
		if (form?.passwordAction) {
			if (form.passwordSuccess) {
				passwordOpen = false;
				passwordSuccess = form.passwordAction === 'disable' ? 'disabled' : 'enabled';
				setTimeout(() => (passwordSuccess = ''), 2500);
			} else if (form.passwordError === 'wrong_password') {
				passwordShaking = true;
				setTimeout(() => (passwordShaking = false), 600);
			}
		}
	});

	async function deleteSpace() {
		deleteConfirming = false;
		const res = await fetch(`/spaces/${data.space.slug}`, { method: 'DELETE' });
		if (res.ok) window.location.href = '/';
	}

	function sinceDate(iso: string): string {
		const d = new Date(iso);
		if (localeStore.locale === 'ru') {
			// Full date puts the month in genitive («4 июля 2026 г.») — strip the day and the «г.»
			return d
				.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
				.replace(/^\d+\s/, '')
				.replace(/\s?г\.$/, '');
		}
		return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{data.space.name} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header
		spaceName={data.space.name}
		spaceSlug={data.space.slug}
		locked={data.hasPassword}
		onNewBoard={data.authenticated ? () => (creating = true) : null}
	/>

	{#if data.showAdminBanner && data.adminLink}
		<AdminBanner adminLink={data.adminLink} titleKey="space.admin.title" copyKey="space.admin.copy" />
	{/if}

	{#if !data.authenticated}
		<SpacePasswordForm spaceName={data.space.name} error={form?.error === 'wrong_password' ? t('space.password.error') : ''} />
	{:else}
		<main class="flex-1 px-4 pb-16 sm:px-8 lg:px-14">
			<div class="mx-auto flex max-w-[1360px] flex-col gap-7 pt-9 sm:pt-11">
				<!-- Space heading -->
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div class="flex min-w-0 flex-col gap-1.5">
						<div class="flex items-center gap-3">
							<h1 class="font-heading min-w-0 truncate text-[24px] font-bold tracking-[-0.02em] text-text-primary sm:text-[30px]">{data.space.name}</h1>
							{#if passwordSuccess}
								<span class="badge badge-success badge-pop shrink-0">
									{t(passwordSuccess === 'enabled' ? 'space.password.enabled' : 'space.password.disabled')}
								</span>
							{/if}
						</div>
						{#if spaceCreatedAt}
							<p class="text-[15px] text-text-secondary">
								{t('space.meta.count', { n: data.boards.length })} · {t('space.meta.since', { date: sinceDate(spaceCreatedAt) })}
							</p>
						{/if}
					</div>
					{#if data.isCreator}
						<div class="flex items-center gap-2">
							{#if deleteConfirming}
								<span class="text-xs text-text-secondary">{t('space.delete.confirm')}</span>
								<button onclick={deleteSpace} class="btn btn-danger btn-sm">
									{t('space.delete')}
								</button>
								<button onclick={() => (deleteConfirming = false)} class="btn btn-secondary btn-sm">
									{t('card.cancel')}
								</button>
							{:else}
								<!-- Password toggle -->
								<div class="flex items-center gap-2">
									<label class="relative inline-flex cursor-pointer items-center" title={t(data.hasPassword ? 'space.password.disable' : 'space.password.enable')}>
										<input
											type="checkbox"
											checked={passwordOpen}
											onchange={() => { passwordOpen = !passwordOpen; deleteConfirming = false; }}
											class="sr-only"
										/>
										<span class="inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 {passwordOpen ? 'bg-accent' : 'bg-border-strong'}">
											<span class="top-0.5 left-0.5 mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] {passwordOpen ? 'translate-x-4' : ''}"></span>
										</span>
									</label>
									<span class="text-xs text-text-muted">
										{#if data.hasPassword}
											<svg class="inline h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
											</svg>
										{:else}
											<svg class="inline h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
											</svg>
										{/if}
									</span>
								</div>
								<!-- Delete button -->
								<button
									onclick={() => { deleteConfirming = true; passwordOpen = false; }}
									class="btn-icon btn-icon-lg btn-icon-bordered hover:bg-bad-bg hover:text-bad"
									title={t('space.delete')}
								>
									<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
										<polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
										<path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
									</svg>
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Password management panel -->
				{#if data.isCreator}
					<div class="collapsible {passwordOpen ? 'open' : ''}">
					<div class="rounded-2xl border border-border bg-surface-card p-4">
						{#if data.hasPassword}
							<form method="POST" action="?/disablePassword" use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										passwordShaking = true;
										setTimeout(() => (passwordShaking = false), 600);
									}
									await update();
								};
							}}>
								<p class="mb-2 text-sm text-text-secondary">{t('space.password.disable.desc')}</p>
								<div class="flex gap-2">
									<input
										type="password"
										name="password"
										required
										maxlength="100"
										placeholder={t('space.password.placeholder')}
										class="input input-md h-10 flex-1 {form?.passwordAction === 'disable' && form?.passwordError === 'wrong_password' ? 'border-bad' : ''} {passwordShaking ? 'animate-[shake_0.5s_ease]' : ''}"
									/>
									<button type="submit" class="btn btn-danger btn-md h-10">
										{t('space.password.disable')}
									</button>
									<button type="button" onclick={() => (passwordOpen = false)} class="btn btn-secondary btn-md h-10">
										{t('card.cancel')}
									</button>
								</div>
								{#if form?.passwordAction === 'disable' && form?.passwordError === 'wrong_password'}
									<p class="mt-1 text-xs text-bad">{t('space.password.error')}</p>
								{/if}
							</form>
						{:else}
							<form method="POST" action="?/enablePassword" use:enhance>
								<p class="mb-2 text-sm text-text-secondary">{t('space.password.enable')}</p>
								<div class="flex gap-2">
									<input
										type="password"
										name="password"
										required
										maxlength="100"
										placeholder={t('space.password.enable.placeholder')}
										class="input input-md h-10 flex-1"
									/>
									<button type="submit" class="btn btn-primary btn-md h-10">
										{t('space.password.enable')}
									</button>
									<button type="button" onclick={() => (passwordOpen = false)} class="btn btn-secondary btn-md h-10">
										{t('card.cancel')}
									</button>
								</div>
							</form>
						{/if}
					</div>
					</div>
				{/if}

				<SpaceBoardGrid boards={data.boards} onNewBoard={() => (creating = true)} />
			</div>
		</main>
	{/if}

	{#if creating}
		<NewBoardModal
			spaceSlug={data.space.slug}
			spaceName={data.space.name}
			{suggestedTitle}
			suggestedFrom={suggestedTitle ? latestTitle : null}
			onClose={() => (creating = false)}
		/>
	{/if}
</div>
