<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n/index.js';

	let sections: HTMLElement[] = [];
	let shown = $state<Record<string, boolean>>({});

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (e.isIntersecting) {
						shown[e.target.id] = true;
					}
				});
			},
			{ threshold: 0.15 }
		);
		sections.forEach((s) => s && observer.observe(s));
		return () => observer.disconnect();
	});

	function v(id: string) {
		return !!shown[id];
	}
</script>

<svelte:head>
	<title>{t('header.brand')}</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<header class="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md px-6 py-3">
		<div class="mx-auto flex max-w-5xl items-center justify-between">
			<a href="/" class="font-heading text-[15px] font-bold text-text-primary">{t('header.brand')}</a>
			<div class="flex items-center gap-4">
				<a href="/changelog" class="text-[13px] text-text-muted transition-colors hover:text-text-primary">{t('changelog.title')}</a>
				<a href="/feedback" class="text-[13px] text-text-muted transition-colors hover:text-text-primary">{t('feedback.link')}</a>
				<a href="/new" class="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover">
					{t('home.create')}
				</a>
			</div>
		</div>
	</header>

	<!-- HERO -->
	<section class="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
		<div class="mx-auto max-w-2xl" style="animation: fadeUp 0.8s cubic-bezier(0.25,1,0.5,1) both;">
			<div class="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-[12px] font-medium text-text-secondary">
				<svg class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				{t('help.badge')}
			</div>
			<h1 class="font-heading text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
				{t('help.hero.title1')}<br />
				<span class="text-accent">{t('help.hero.title2')}</span>
			</h1>
			<p class="mt-6 text-lg leading-relaxed text-text-secondary">{t('help.hero.desc')}</p>
			<div class="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<a href="/new" class="rounded-xl bg-accent px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98]">
					{t('help.hero.cta')}
				</a>
				<a href="#features" class="text-[14px] font-medium text-text-secondary transition-colors hover:text-text-primary">
					{t('help.hero.learn')}
				</a>
			</div>
		</div>
	</section>

	<!-- FEATURES -->
	<section id="features" class="px-6 py-24">
		<div class="mx-auto max-w-5xl">
			<!-- Spaces -->
			<div bind:this={sections[0]} id="f0" class="grid items-center gap-16 py-16 md:grid-cols-2 transition-all duration-700 {v('f0') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}">
				<div>
					<div class="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
						{t('help.spaces.tag')}
					</div>
					<h2 class="font-heading text-3xl font-bold text-text-primary">{t('help.spaces.title')}</h2>
					<p class="mt-4 text-[15px] leading-relaxed text-text-secondary">{t('help.spaces.desc')}</p>
				</div>
				<div class="rounded-2xl border border-border bg-surface-card p-6 shadow-sm">
					<div class="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">BOARDS · 4</div>
					<div class="grid grid-cols-2 gap-3">
						{#each ['Sprint 42', 'Sprint 41', 'Sprint 40', 'Sprint 39'] as name, i}
							<div class="rounded-xl border border-border bg-surface-hover p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
								<div class="mb-2 flex gap-1">
									<div class="h-1 w-6 rounded-full bg-well/30"></div>
									<div class="h-1 w-4 rounded-full bg-bad/30"></div>
									<div class="h-1 w-5 rounded-full bg-improve/30"></div>
								</div>
								<div class="text-[13px] font-semibold text-text-primary">{name}</div>
								<div class="text-[11px] text-text-muted">14 Mar · 7 cards</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Boards -->
			<div bind:this={sections[1]} id="f1" class="grid items-center gap-16 py-16 md:grid-cols-2 transition-all duration-700 {v('f1') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}">
				<div class="order-2 md:order-1 rounded-2xl border border-border bg-surface-card p-6 shadow-sm">
					<div class="flex gap-4">
						{#each [
							{ dot: 'bg-well', title: t('column.went_well'), n: 3 },
							{ dot: 'bg-bad', title: t('column.didnt_go_well'), n: 2 },
							{ dot: 'bg-improve', title: t('column.improve'), n: 2 }
						] as col}
							<div class="flex-1">
								<div class="mb-2 flex items-center gap-1.5">
									<div class="h-2 w-2 rounded-full {col.dot}"></div>
									<span class="text-[11px] font-semibold text-text-primary">{col.title}</span>
								</div>
								{#each Array(col.n) as _}
									<div class="mb-1.5 rounded-lg border border-border bg-surface p-2">
										<div class="mb-1 h-2 w-full rounded bg-border/60"></div>
										<div class="h-2 w-3/4 rounded bg-border/40"></div>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</div>
				<div class="order-1 md:order-2">
					<div class="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
						{t('help.boards.tag')}
					</div>
					<h2 class="font-heading text-3xl font-bold text-text-primary">{t('help.boards.title')}</h2>
					<p class="mt-4 text-[15px] leading-relaxed text-text-secondary">{t('help.boards.desc')}</p>
				</div>
			</div>

			<!-- Timer -->
			<div bind:this={sections[2]} id="f2" class="grid items-center gap-16 py-16 md:grid-cols-2 transition-all duration-700 {v('f2') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}">
				<div>
					<div class="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent">
						<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
						{t('help.timer.tag')}
					</div>
					<h2 class="font-heading text-3xl font-bold text-text-primary">{t('help.timer.title')}</h2>
					<p class="mt-4 text-[15px] leading-relaxed text-text-secondary">{t('help.timer.desc')}</p>
				</div>
				<div class="flex items-center justify-center rounded-2xl border border-border bg-surface-card p-8 shadow-sm">
					<div class="flex flex-col items-center gap-4">
						<div class="flex items-center overflow-hidden rounded-xl border border-border">
							<div class="flex h-10 w-9 items-center justify-center text-text-muted">−</div>
							<div class="flex h-10 w-12 items-center justify-center border-x border-border text-[15px] font-bold">5</div>
							<div class="flex h-10 w-9 items-center justify-center text-text-muted">+</div>
							<div class="flex h-10 w-10 items-center justify-center rounded-r-xl bg-accent text-white">
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
							</div>
						</div>
						<div class="flex items-center gap-3 rounded-xl border border-border px-4 py-2.5">
							<span class="text-xl font-bold tabular-nums">03:42</span>
							<div class="h-[3px] w-20 overflow-hidden rounded-full bg-border">
								<div class="h-full w-[65%] rounded-full bg-well"></div>
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
			<h2 bind:this={sections[3]} id="f3" class="font-heading text-3xl font-bold text-text-primary transition-all duration-700 {v('f3') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}">
				{t('help.how.title')}
			</h2>
			<div class="mt-16 grid gap-12 sm:grid-cols-3">
				{#each [1, 2, 3] as n, i}
					<div bind:this={sections[4 + i]} id="f{4 + i}" class="transition-all duration-700 {v(`f${4 + i}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}" style="transition-delay: {i * 150}ms">
						<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 font-heading text-xl font-bold text-accent">{n}</div>
						<h3 class="font-heading text-lg font-bold text-text-primary">{t(`help.how.${n}.title`)}</h3>
						<p class="mt-2 text-[14px] leading-relaxed text-text-secondary">{t(`help.how.${n}.desc`)}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- FINAL CTA -->
	<section bind:this={sections[7]} id="f7" class="px-6 py-24 transition-all duration-700 {v('f7') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}">
		<div class="mx-auto max-w-2xl rounded-2xl bg-text-primary px-8 py-16 text-center text-surface shadow-xl">
			<h2 class="font-heading text-3xl font-bold">{t('help.cta.title')}</h2>
			<p class="mt-3 text-[15px] opacity-70">{t('help.cta.desc')}</p>
			<a href="/new" class="mt-8 inline-block rounded-xl bg-accent px-8 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-lg active:scale-[0.98]">
				{t('help.hero.cta')}
			</a>
		</div>
	</section>

	<footer class="border-t border-border px-6 py-8 text-center text-[12px] text-text-muted">
		<div class="mb-2 flex items-center justify-center gap-4">
			<a href="/changelog" class="text-text-muted transition-colors hover:text-text-secondary">{t('changelog.title')}</a>
			<span class="text-border">·</span>
			<a href="/feedback" class="text-text-muted transition-colors hover:text-text-secondary">{t('feedback.link')}</a>
		</div>
		{t('header.brand')} · {t('help.footer')}
	</footer>
</div>
