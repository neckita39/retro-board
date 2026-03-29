<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';

	let sections: HTMLElement[] = [];

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						e.target.classList.add('visible');
					}
				});
			},
			{ threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
		);
		sections.forEach((s) => s && observer.observe(s));
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>{t('header.brand')}</title>
</svelte:head>

<div class="min-h-screen overflow-hidden bg-surface">
	<Header showCreate />

	<!-- HERO -->
	<section class="relative flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
		<!-- Ambient glow -->
		<div class="glow-orb -top-32 right-[10%] h-[500px] w-[500px] bg-accent/15 blur-[120px]"></div>
		<div class="glow-orb top-[30%] -left-[5%] h-[400px] w-[400px] bg-improve/10 blur-[100px]" style="animation-delay: -4s;"></div>
		<div class="glow-orb -bottom-20 right-[30%] h-[350px] w-[350px] bg-well/10 blur-[100px]" style="animation-delay: -8s;"></div>

		<div class="hero-stagger relative mx-auto max-w-3xl">
			<!-- Badge -->
			<div class="badge badge-outline mb-8 gap-2 px-4 py-1.5 text-[12px] shadow-sm backdrop-blur-sm">
				<svg class="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
				{t('help.badge')}
			</div>

			<!-- Title -->
			<h1 class="font-heading text-5xl font-bold leading-[1.08] tracking-tight text-text-primary sm:text-6xl lg:text-7xl">
				{t('help.hero.title1')}<br />
				<span class="text-gradient">{t('help.hero.title2')}</span>
			</h1>

			<!-- Subtitle -->
			<p class="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-text-secondary">
				{t('help.hero.desc')}
			</p>

			<!-- CTA -->
			<div class="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<a href="/new" class="btn btn-primary btn-lg shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/35 group relative overflow-hidden">
					<span class="relative z-10">{t('help.hero.cta')}</span>
					<div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"></div>
				</a>
				<a href="#features" class="text-[14px] font-medium text-text-muted transition-colors hover:text-text-primary">
					{t('help.hero.learn')}
				</a>
			</div>
		</div>
	</section>

	<!-- FEATURES -->
	<section id="features" class="px-6 py-20">
		<div class="mx-auto max-w-5xl">
			<!-- Spaces -->
			<div bind:this={sections[0]} class="reveal-section grid items-center gap-12 py-20 md:grid-cols-2 lg:gap-20">
				<div class="reveal-child">
					<div class="badge badge-accent mb-3 gap-2 text-[12px]">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
						{t('help.spaces.tag')}
					</div>
					<h2 class="font-heading text-3xl font-bold leading-tight text-text-primary lg:text-4xl">{t('help.spaces.title')}</h2>
					<p class="mt-4 text-[15px] leading-relaxed text-text-secondary">{t('help.spaces.desc')}</p>
				</div>
				<div class="reveal-child card card-lg card-interactive shadow-sm hover:shadow-lg">
					<div class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{t('space.boards.title')}</div>
					<div class="grid grid-cols-2 gap-3">
						{#each ['Sprint 42', 'Sprint 41', 'Sprint 40', 'Sprint 39'] as name, i}
							<div class="rounded-xl border border-border bg-surface-hover p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style="animation-delay: {i * 80}ms;">
								<div class="mb-2 flex gap-1">
									<div class="h-1 w-6 rounded-full bg-well/40"></div>
									<div class="h-1 w-4 rounded-full bg-bad/40"></div>
									<div class="h-1 w-5 rounded-full bg-improve/40"></div>
								</div>
								<div class="text-[13px] font-semibold text-text-primary">{name}</div>
								<div class="text-[11px] text-text-muted">{t('column.cards', { n: 7 })}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Boards -->
			<div bind:this={sections[1]} class="reveal-section grid items-center gap-12 py-20 md:grid-cols-2 lg:gap-20">
				<div class="order-2 md:order-1 reveal-child card card-lg card-interactive shadow-sm hover:shadow-lg">
					<div class="flex gap-3">
						{#each [
							{ dot: 'bg-well', bg: 'bg-well-bg/40', title: t('column.went_well'), n: 3 },
							{ dot: 'bg-bad', bg: 'bg-bad-bg/40', title: t('column.didnt_go_well'), n: 2 },
							{ dot: 'bg-improve', bg: 'bg-improve-bg/40', title: t('column.improve'), n: 2 }
						] as col}
							<div class="flex-1 rounded-xl {col.bg} p-2">
								<div class="mb-2 flex items-center gap-1.5 px-1">
									<div class="h-2 w-2 rounded-full {col.dot}"></div>
									<span class="text-[10px] font-semibold text-text-primary">{col.title}</span>
								</div>
								{#each Array(col.n) as _}
									<div class="mb-1.5 rounded-lg border border-border/60 bg-surface-card p-2">
										<div class="mb-1 h-2 w-full rounded bg-border/50"></div>
										<div class="h-2 w-3/4 rounded bg-border/30"></div>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</div>
				<div class="order-1 md:order-2 reveal-child">
					<div class="badge badge-accent mb-3 gap-2 text-[12px]">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
						{t('help.boards.tag')}
					</div>
					<h2 class="font-heading text-3xl font-bold leading-tight text-text-primary lg:text-4xl">{t('help.boards.title')}</h2>
					<p class="mt-4 text-[15px] leading-relaxed text-text-secondary">{t('help.boards.desc')}</p>
				</div>
			</div>

			<!-- Timer -->
			<div bind:this={sections[2]} class="reveal-section grid items-center gap-12 py-20 md:grid-cols-2 lg:gap-20">
				<div class="reveal-child">
					<div class="badge badge-accent mb-3 gap-2 text-[12px]">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
						{t('help.timer.tag')}
					</div>
					<h2 class="font-heading text-3xl font-bold leading-tight text-text-primary lg:text-4xl">{t('help.timer.title')}</h2>
					<p class="mt-4 text-[15px] leading-relaxed text-text-secondary">{t('help.timer.desc')}</p>
				</div>
				<div class="reveal-child card card-interactive shadow-sm hover:shadow-lg flex items-center justify-center p-8">
					<div class="flex flex-col items-center gap-4">
						<div class="flex items-center overflow-hidden rounded-xl border border-border">
							<div class="flex h-10 w-9 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover">−</div>
							<div class="flex h-10 w-12 items-center justify-center border-x border-border text-[15px] font-bold tabular-nums">5</div>
							<div class="flex h-10 w-9 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover">+</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-r-xl bg-accent text-white">
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
							</div>
						</div>
						<div class="flex items-center gap-3 rounded-xl border border-border px-5 py-3">
							<span class="text-xl font-bold tabular-nums">03:42</span>
							<div class="h-[3px] w-24 overflow-hidden rounded-full bg-border">
								<div class="h-full w-[65%] rounded-full bg-well transition-all duration-300"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- HOW IT WORKS -->
	<section class="border-t border-border px-6 py-24">
		<div class="mx-auto max-w-3xl text-center">
			<h2 bind:this={sections[3]} class="reveal-section font-heading text-3xl font-bold text-text-primary lg:text-4xl">
				{t('help.how.title')}
			</h2>
			<div class="mt-16 grid gap-12 sm:grid-cols-3">
				{#each [1, 2, 3] as n, i}
					<div bind:this={sections[4 + i]} class="reveal-section" style="transition-delay: {i * 120}ms;">
						<div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 font-heading text-2xl font-bold text-accent">{n}</div>
						<h3 class="font-heading text-lg font-bold text-text-primary">{t(`help.how.${n}.title`)}</h3>
						<p class="mt-2 text-[14px] leading-relaxed text-text-secondary">{t(`help.how.${n}.desc`)}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FINAL CTA -->
	<section bind:this={sections[7]} class="reveal-section px-6 py-24">
		<div class="relative mx-auto max-w-2xl overflow-hidden rounded-3xl bg-text-primary px-8 py-20 text-center text-surface shadow-2xl">
			<!-- Background glow in CTA -->
			<div class="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-accent/30 blur-[80px]"></div>
			<div class="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-improve/20 blur-[80px]"></div>
			<h2 class="relative font-heading text-3xl font-bold lg:text-4xl">{t('help.cta.title')}</h2>
			<p class="relative mt-3 text-[15px] opacity-60">{t('help.cta.desc')}</p>
			<a href="/new" class="btn btn-primary btn-lg shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/35 group relative mt-8 inline-block overflow-hidden">
				<span class="relative z-10">{t('help.hero.cta')}</span>
				<div class="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"></div>
			</a>
		</div>
	</section>

	<footer class="border-t border-border px-6 py-8 text-center text-[12px] text-text-muted">
		<div class="mb-2 flex items-center justify-center gap-4">
			<a href="/changelog" class="transition-colors hover:text-text-secondary">{t('changelog.title')}</a>
			<span class="text-border">·</span>
			<button onclick={() => feedbackStore.show()} class="transition-colors hover:text-text-secondary">{t('feedback.link')}</button>
		</div>
		{t('header.brand')} · {t('help.footer')}
	</footer>
</div>
