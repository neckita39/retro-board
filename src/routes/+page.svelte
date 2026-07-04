<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';

	boardStore.board = null;

	// Live board mock in the hero — a shrunken copy of the real board screen
	let mockNames = $derived([t('home.mock.name1'), t('home.mock.name2'), t('home.mock.name3')]);
	const avatarColors = ['bg-well', 'bg-improve', 'bg-bad'];
</script>

<svelte:head>
	<title>{t('header.brand')}</title>
</svelte:head>

{#snippet mockLike(n: number, active: boolean)}
	<span class="inline-flex items-center gap-[3px] rounded-full px-[7px] py-[2px] text-[10px] font-bold {active ? 'bg-well-bg text-well-strong' : 'border border-border text-text-muted'}">
		<svg width="10" height="10" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>{n}
	</span>
{/snippet}

{#snippet mockDislike(n: number)}
	<span class="inline-flex items-center gap-[3px] rounded-full border border-border px-[7px] py-[2px] text-[10px] font-bold text-text-muted">
		<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>{n}
	</span>
{/snippet}

<div class="flex min-h-screen flex-col bg-surface">
	<Header showNav showCreate />

	<main class="flex-1">
		<!-- HERO -->
		<section class="mx-auto grid max-w-[1360px] items-center gap-10 px-5 pb-10 pt-12 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:px-14 lg:pb-14 lg:pt-16">
			<div class="flex flex-col gap-5" style="animation: fadeUp 0.6s cubic-bezier(0.25,1,0.5,1) both;">
				<div class="flex flex-wrap gap-2">
					<span class="rounded-full border border-border-strong bg-surface-card px-3 py-[5px] text-xs font-bold text-text-secondary">{t('home.hero.badge1')}</span>
					<span class="rounded-full border border-border-strong bg-surface-card px-3 py-[5px] text-xs font-bold text-text-secondary">{t('home.hero.badge2')}</span>
				</div>
				<h1 class="font-heading text-[32px] font-bold leading-[1.15] tracking-[-0.03em] text-text-primary sm:text-[40px]">
					{t('home.hero.title1')}<br />{t('home.hero.title2')}
				</h1>
				<p class="max-w-[420px] text-[17px] leading-relaxed text-text-secondary">
					{t('home.hero.desc')}
				</p>
				<div class="flex flex-wrap gap-3">
					<a href="/new" class="btn btn-primary btn-lg">{t('home.hero.cta')}</a>
					<a href="#how" class="btn btn-secondary btn-lg">{t('home.hero.how')}</a>
				</div>
			</div>

			<!-- Live board mock -->
			<div class="flex flex-col gap-3.5 rounded-[18px] border border-border bg-surface-card p-5 shadow-[0_16px_40px_rgba(33,30,26,0.10)]" style="animation: fadeUp 0.6s cubic-bezier(0.25,1,0.5,1) 0.15s both;" aria-hidden="true">
				<div class="flex items-center justify-between">
					<span class="font-heading text-[15px] font-bold text-text-primary">{t('home.mock.board')}</span>
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold tabular-nums text-accent">04:32</span>
						<div class="flex">
							{#each mockNames as name, i (name)}
								<span class="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-surface-card text-[10px] font-bold text-white {avatarColors[i]} {i > 0 ? '-ml-[7px]' : ''}">{name[0]}</span>
							{/each}
						</div>
					</div>
				</div>
				<div class="grid grid-cols-3 gap-2.5">
					<div class="flex min-w-0 flex-col gap-2">
						<div class="h-[3px] rounded-full bg-well"></div>
						<div class="flex flex-col gap-2 rounded-[10px] border border-border p-2.5">
							<span class="text-xs leading-[1.45] text-text-primary">{t('home.mock.card1')}</span>
							<div class="flex items-center gap-[5px]">
								{@render mockLike(5, true)}
								{@render mockDislike(0)}
								<span class="ml-auto truncate text-[10px] text-text-muted">{mockNames[0]}</span>
							</div>
						</div>
						<div class="flex flex-col gap-2 rounded-[10px] border border-border p-2.5">
							<span class="text-xs leading-[1.45] text-text-primary">{t('home.mock.card2')}</span>
							<div class="flex items-center gap-[5px]">
								{@render mockLike(3, false)}
								<span class="ml-auto truncate text-[10px] text-text-muted">{mockNames[1]}</span>
							</div>
						</div>
					</div>
					<div class="flex min-w-0 flex-col gap-2">
						<div class="h-[3px] rounded-full bg-bad"></div>
						<div class="flex flex-col gap-2 rounded-[10px] border border-border p-2.5">
							<span class="text-xs leading-[1.45] text-text-primary">{t('home.mock.card3')}</span>
							<div class="flex items-center gap-[5px]">
								{@render mockLike(6, true)}
								{@render mockDislike(1)}
								<span class="ml-auto truncate text-[10px] text-text-muted">{mockNames[2]}</span>
							</div>
						</div>
					</div>
					<div class="flex min-w-0 flex-col gap-2">
						<div class="h-[3px] rounded-full bg-improve"></div>
						<div class="flex flex-col gap-2 rounded-[10px] border border-border p-2.5">
							<span class="text-xs leading-[1.45] text-text-primary">{t('home.mock.card4')}</span>
							<div class="flex items-center gap-[5px]">
								{@render mockLike(2, false)}
							</div>
						</div>
						<div class="rounded-[10px] border-[1.5px] border-dashed border-border-strong p-2.5 text-xs text-text-muted">{t('home.mock.add')}</div>
					</div>
				</div>
			</div>
		</section>

		<!-- STEPS -->
		<section id="how" class="mx-auto grid max-w-[1360px] gap-5 px-5 pb-14 sm:grid-cols-3 sm:px-8 lg:px-14">
			{#each [1, 2, 3] as n (n)}
				<div class="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-card p-6">
					<span class="font-heading text-[15px] font-extrabold text-accent">0{n}</span>
					<span class="font-heading text-[19px] font-bold text-text-primary">{t(`home.step${n}.title`)}</span>
					<p class="text-sm leading-relaxed text-text-secondary">{t(`home.step${n}.desc`)}</p>
				</div>
			{/each}
		</section>
	</main>

	<!-- Footer — a single line duplicating the header nav -->
	<footer class="border-t border-border bg-surface-card px-5 py-5 sm:px-8 lg:px-14">
		<div class="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-3 sm:flex-row">
			<span class="text-[13px] text-text-muted">{t('home.footer.tagline')}</span>
			<div class="flex flex-wrap items-center gap-5 text-[13px] text-text-secondary">
				<a href="https://github.com/neckita39/retro-board" target="_blank" rel="noopener" class="transition-colors hover:text-text-primary">GitHub</a>
				<a href="/changelog" class="transition-colors hover:text-text-primary">{t('nav.changelog')}</a>
				<a href="/api" class="transition-colors hover:text-text-primary">{t('nav.api')}</a>
				<button onclick={() => feedbackStore.show()} class="transition-colors hover:text-text-primary">{t('nav.feedback')}</button>
			</div>
		</div>
	</footer>
</div>
