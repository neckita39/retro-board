<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import AdminBanner from '$lib/components/AdminBanner.svelte';
	import SpacePasswordForm from '$lib/components/SpacePasswordForm.svelte';
	import SpaceBoardGrid from '$lib/components/SpaceBoardGrid.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { data, form } = $props();

	boardStore.board = null;

	let deleteConfirming = $state(false);
	let copiedShare = $state(false);
	let copiedAdmin = $state(false);

	async function copyShareLink() {
		const link = `${window.location.origin}/spaces/${data.space.slug}`;
		await navigator.clipboard.writeText(link);
		copiedShare = true;
		setTimeout(() => (copiedShare = false), 2000);
	}

	async function copyAdminLink() {
		if (!data.adminLink) return;
		await navigator.clipboard.writeText(data.adminLink);
		copiedAdmin = true;
		setTimeout(() => (copiedAdmin = false), 2000);
	}

	async function deleteSpace() {
		deleteConfirming = false;
		const res = await fetch(`/spaces/${data.space.slug}`, { method: 'DELETE' });
		if (res.ok) window.location.href = '/';
	}

	const passwordError = $derived(form?.passwordError ? t(form.passwordError) : '');
	const hasAccess = $derived(form?.success || data.hasAccess);
</script>

<svelte:head>
	<title>{data.space.name} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header spaceName={data.space.name} spaceSlug={data.space.slug} />

	{#if data.showAdminBanner && data.adminLink}
		<AdminBanner adminLink={data.adminLink} titleKey="space.admin.title" descKey="space.admin.desc" copyKey="space.admin.copy" />
	{/if}

	<main class="flex flex-1 items-start justify-center p-4 pt-8">
		{#if !hasAccess}
			<SpacePasswordForm error={passwordError} />
		{:else}
			<div class="w-full max-w-4xl space-y-6">
				<div class="flex items-center justify-between">
					<h1 class="text-2xl font-bold text-text-primary">{data.space.name}</h1>
					<div class="flex items-center gap-2">
						<button
							onclick={copyShareLink}
							class="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm transition-colors hover:bg-surface-hover {copiedShare ? 'text-emerald-500' : 'text-text-muted'}"
							title={copiedShare ? t('copy.copied') : t('copy.share')}
						>
							{#if copiedShare}
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
							{/if}
							{t('copy.share')}
						</button>
					{#if data.isCreator}
						{#if data.adminLink}
							<button
								onclick={copyAdminLink}
								class="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm transition-colors hover:bg-surface-hover {copiedAdmin ? 'text-emerald-500' : 'text-text-muted'}"
								title={copiedAdmin ? t('copy.copied') : t('copy.admin')}
							>
								{#if copiedAdmin}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12"/>
									</svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
									</svg>
								{/if}
								{t('copy.admin')}
							</button>
						{/if}
						{#if deleteConfirming}
							<div class="flex items-center gap-2">
								<span class="text-xs text-text-secondary">{t('space.delete.confirm')}</span>
								<button
									onclick={deleteSpace}
									class="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
								>
									{t('space.delete')}
								</button>
								<button
									onclick={() => (deleteConfirming = false)}
									class="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
								>
									{t('card.cancel')}
								</button>
							</div>
						{:else}
							<button
								onclick={() => (deleteConfirming = true)}
								class="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
								title={t('space.delete')}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6"/>
									<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
									<path d="M10 11v6"/>
									<path d="M14 11v6"/>
									<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
								</svg>
							</button>
						{/if}
					{/if}
					</div>
				</div>
				<SpaceBoardGrid boards={data.boards} spaceSlug={data.space.slug} />
			</div>
		{/if}
	</main>
</div>
