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
		<AdminBanner adminLink={data.adminLink} titleKey="space.admin.title" descKey="space.admin.desc" copyKey="space.admin.copy" />
	{/if}

	{#if !data.authenticated}
		<SpacePasswordForm spaceName={data.space.name} error={form?.error === 'wrong_password' ? t('space.password.error') : ''} />
	{:else}
		<main class="flex-1 p-5">
			<div class="mx-auto max-w-[1100px]">
				<!-- Space header -->
				<div class="flex flex-wrap items-center justify-between gap-3 pb-4 pt-6">
					<h1 class="font-heading text-2xl font-bold text-text-primary">{data.space.name}</h1>
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
								<button
									onclick={() => (deleteConfirming = true)}
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

				<SpaceBoardGrid boards={data.boards} spaceSlug={data.space.slug} />
			</div>
		</main>
	{/if}
</div>
