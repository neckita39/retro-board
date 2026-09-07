<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { t } from '$lib/i18n/index.js';
	import { findFormat } from '$lib/content/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { SITE } from '$lib/seo.js';
	import { boardStore } from '$lib/stores/board.svelte.js';

	let { data } = $props();

	boardStore.board = null;

	// Слаг приходит с сервера уже проверенным — 404 отсеян в +page.server.ts.
	let format = $derived(findFormat(data.slug)!);

	let howTo = $derived({
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name: txt(format.seoTitle),
		description: txt(format.seoDescription),
		totalTime: `PT${format.minutes}M`,
		step: format.steps.map((s, i) => ({
			'@type': 'HowToStep',
			position: i + 1,
			text: txt(s)
		}))
	});

	let breadcrumbs = $derived({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: t('nav.formats'), item: `${SITE}/formats` },
			{ '@type': 'ListItem', position: 2, name: txt(format.name), item: `${SITE}/formats/${format.slug}` }
		]
	});
</script>

<Seo
	title={txt(format.seoTitle)}
	description={txt(format.seoDescription)}
	path="/formats/{format.slug}"
/>
<JsonLd data={howTo} />
<JsonLd data={breadcrumbs} />

<div class="min-h-screen bg-surface">
	<Header showNav showCreate />

	<main class="mx-auto flex max-w-[760px] flex-col gap-9 px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
		<nav class="text-[13px] text-text-muted" aria-label={t('formats.breadcrumb')}>
			<a href="/formats" class="transition-colors hover:text-text-primary">{t('nav.formats')}</a>
			<span class="px-1.5">/</span>
			<span class="text-text-secondary">{txt(format.name)}</span>
		</nav>

		<header class="flex flex-col gap-3">
			<h1 class="font-heading text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary sm:text-[34px]">
				{txt(format.name)}
			</h1>
			<p class="text-[17px] leading-relaxed text-text-secondary">{txt(format.tagline)}</p>
			<div class="flex flex-wrap gap-1.5">
				<span class="rounded-full border border-border bg-surface-card px-2.5 py-[3px] text-xs font-semibold text-text-secondary">
					{t('formats.meta.minutes', { n: format.minutes })}
				</span>
				<span class="rounded-full border border-border bg-surface-card px-2.5 py-[3px] text-xs font-semibold text-text-secondary">
					{txt(format.teamSize)}
				</span>
				<span class="rounded-full border border-border bg-surface-card px-2.5 py-[3px] text-xs font-semibold text-text-secondary">
					{t('formats.meta.columns', { n: format.columns.length })}
				</span>
			</div>
		</header>

		<p class="text-[17px] leading-[1.75] text-text-primary/90">{txt(format.intro)}</p>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('formats.section.columns')}</h2>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each format.columns as col (col.title.en)}
					<div class="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-card p-5">
						<span class="font-heading text-[16px] font-bold text-text-primary">{txt(col.title)}</span>
						<span class="text-sm leading-relaxed text-text-secondary">{txt(col.hint)}</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('formats.section.when')}</h2>
			<ul class="list-disc space-y-1.5 pl-[18px] text-[16px] leading-[1.7] text-text-primary/85 marker:text-text-muted">
				{#each format.whenToUse as item (item.en)}
					<li>{txt(item)}</li>
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('formats.section.steps')}</h2>
			<ol class="flex flex-col gap-3">
				{#each format.steps as step, i (step.en)}
					<li class="flex gap-3.5">
						<span class="font-heading mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-extrabold text-white">
							{i + 1}
						</span>
						<span class="text-[16px] leading-[1.7] text-text-primary/90">{txt(step)}</span>
					</li>
				{/each}
			</ol>
		</section>

		<section class="flex flex-col gap-2.5 rounded-2xl border border-bad/30 bg-bad-bg p-5 sm:p-6">
			<h2 class="font-heading text-[17px] font-bold text-text-primary">{t('formats.section.watch')}</h2>
			<p class="text-[15px] leading-[1.7] text-text-primary/85">{txt(format.watchOut)}</p>
		</section>

		<section class="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface-card p-6">
			<h2 class="font-heading text-[19px] font-bold text-text-primary">{t('formats.cta.title')}</h2>
			<p class="text-[15px] leading-relaxed text-text-secondary">{t('formats.cta.desc')}</p>
			<div class="flex flex-wrap gap-2.5">
				<a href="/new" class="btn btn-primary btn-md">{t('home.hero.cta')}</a>
				<a href="/how-to-run-a-retro" class="btn btn-secondary btn-md">{t('formats.cta.guide')}</a>
			</div>
		</section>
	</main>
</div>
