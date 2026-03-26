<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import AdminBanner from '$lib/components/AdminBanner.svelte';
	import SpacePasswordForm from '$lib/components/SpacePasswordForm.svelte';
	import SpaceBoardGrid from '$lib/components/SpaceBoardGrid.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
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

	let deleteConfirming = $state(false);
	let passwordOpen = $state(false);
	let passwordShaking = $state(false);
	let passwordSuccess = $state('');

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
</script>

<svelte:head>
	<title>{data.space.name} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header spaceName={data.space.name} spaceSlug={data.space.slug} />

	{#if data.showAdminBanner && data.adminLink}
		<AdminBanner adminLink={data.adminLink} titleKey="space.admin.title" copyKey="space.admin.copy" />
	{/if}

	{#if !data.authenticated}
		<SpacePasswordForm spaceName={data.space.name} error={form?.error === 'wrong_password' ? t('space.password.error') : ''} />
	{:else}
		<main class="flex-1 p-5">
			<div class="mx-auto max-w-[1100px]">
				<!-- Space header -->
				<div class="flex flex-wrap items-center justify-between gap-3 pb-4 pt-6">
					<div class="flex items-center gap-2">
						<h1 class="font-heading text-2xl font-bold text-text-primary">{data.space.name}</h1>
						{#if passwordSuccess}
							<span class="badge-pop rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
								{t(passwordSuccess === 'enabled' ? 'space.password.enabled' : 'space.password.disabled')}
							</span>
						{/if}
					</div>
					{#if data.isCreator}
						<div class="flex items-center gap-2">
							{#if deleteConfirming}
								<span class="text-xs text-text-secondary">{t('space.delete.confirm')}</span>
								<button onclick={deleteSpace} class="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-600">
									{t('space.delete')}
								</button>
								<button onclick={() => (deleteConfirming = false)} class="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-hover">
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
									class="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
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
					<div class="mb-4 rounded-xl border border-border bg-surface-hover p-4">
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
										class="h-9 flex-1 rounded-lg border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent {form?.passwordAction === 'disable' && form?.passwordError === 'wrong_password' ? 'border-red-400' : 'border-border'} {passwordShaking ? 'animate-[shake_0.5s_ease]' : ''}"
									/>
									<button type="submit" class="h-9 rounded-lg bg-red-500 px-3 text-sm font-medium text-white hover:bg-red-600">
										{t('space.password.disable')}
									</button>
									<button type="button" onclick={() => (passwordOpen = false)} class="h-9 rounded-lg border border-border px-3 text-sm text-text-secondary hover:bg-surface-hover">
										{t('card.cancel')}
									</button>
								</div>
								{#if form?.passwordAction === 'disable' && form?.passwordError === 'wrong_password'}
									<p class="mt-1 text-xs text-red-500">{t('space.password.error')}</p>
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
										class="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
									/>
									<button type="submit" class="h-9 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover">
										{t('space.password.enable')}
									</button>
									<button type="button" onclick={() => (passwordOpen = false)} class="h-9 rounded-lg border border-border px-3 text-sm text-text-secondary hover:bg-surface-hover">
										{t('card.cancel')}
									</button>
								</div>
							</form>
						{/if}
					</div>
					</div>
				{/if}

				<SpaceBoardGrid boards={data.boards} spaceSlug={data.space.slug} />
			</div>
		</main>
	{/if}
</div>
