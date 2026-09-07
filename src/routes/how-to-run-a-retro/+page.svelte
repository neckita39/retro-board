<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { t } from '$lib/i18n/index.js';
	import { GUIDE_INTRO, GUIDE_STEPS, GUIDE_MISTAKES, GUIDE_FAQ } from '$lib/content/guide.js';
	import { FORMATS } from '$lib/content/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { boardStore } from '$lib/stores/board.svelte.js';

	boardStore.board = null;

	let totalMinutes = GUIDE_STEPS.reduce((sum, s) => sum + s.minutes, 0);

	let howTo = $derived({
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name: t('guide.seo.title'),
		description: t('guide.seo.description'),
		totalTime: `PT${totalMinutes}M`,
		step: GUIDE_STEPS.map((s, i) => ({
			'@type': 'HowToStep',
			position: i + 1,
			name: txt(s.title),
			text: txt(s.body)
		}))
	});

	let faq = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: GUIDE_FAQ.map((item) => ({
			'@type': 'Question',
			name: txt(item.question),
			acceptedAnswer: { '@type': 'Answer', text: txt(item.answer) }
		}))
	});
</script>

<Seo
	title={t('guide.seo.title')}
	description={t('guide.seo.description')}
	path="/how-to-run-a-retro"
/>
<JsonLd data={howTo} />
<JsonLd data={faq} />

<div class="min-h-screen bg-surface">
	<Header showNav showCreate />

	<main class="mx-auto flex max-w-[760px] flex-col gap-9 px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
		<header class="flex flex-col gap-3">
			<h1 class="font-heading text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary sm:text-[34px]">
				{t('guide.heading')}
			</h1>
			<span class="text-[13px] text-text-muted">{t('guide.meta', { n: totalMinutes })}</span>
		</header>

		<p class="text-[17px] leading-[1.75] text-text-primary/90">{txt(GUIDE_INTRO)}</p>

		<section class="flex flex-col gap-5">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('guide.section.steps')}</h2>
			<ol class="flex flex-col gap-4">
				{#each GUIDE_STEPS as step, i (step.title.en)}
					<li class="flex gap-3.5 rounded-2xl border border-border bg-surface-card p-5">
						<span class="font-heading mt-[1px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-extrabold text-white">
							{i + 1}
						</span>
						<div class="flex min-w-0 flex-col gap-1.5">
							<div class="flex flex-wrap items-baseline gap-x-2.5">
								<h3 class="font-heading text-[17px] font-bold text-text-primary">{txt(step.title)}</h3>
								<span class="text-xs font-semibold text-text-muted">{t('guide.step.minutes', { n: step.minutes })}</span>
							</div>
							<p class="text-[15px] leading-[1.7] text-text-primary/85">{txt(step.body)}</p>
						</div>
					</li>
				{/each}
			</ol>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('guide.section.mistakes')}</h2>
			<ul class="list-disc space-y-2 pl-[18px] text-[16px] leading-[1.7] text-text-primary/85 marker:text-text-muted">
				{#each GUIDE_MISTAKES as item (item.en)}
					<li>{txt(item)}</li>
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('guide.section.formats')}</h2>
			<p class="text-[16px] leading-[1.7] text-text-primary/85">{t('guide.formats.desc')}</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each FORMATS as format (format.slug)}
					<a
						href="/formats/{format.slug}"
						class="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-card p-5 transition-colors hover:bg-surface-hover"
					>
						<span class="font-heading text-[16px] font-bold text-text-primary">{txt(format.name)}</span>
						<span class="text-sm leading-relaxed text-text-secondary">{txt(format.tagline)}</span>
					</a>
				{/each}
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('guide.section.faq')}</h2>
			<div class="flex flex-col gap-3">
				{#each GUIDE_FAQ as item (item.question.en)}
					<div class="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-card p-5">
						<h3 class="font-heading text-[16px] font-bold text-text-primary">{txt(item.question)}</h3>
						<p class="text-[15px] leading-[1.7] text-text-primary/85">{txt(item.answer)}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface-card p-6">
			<h2 class="font-heading text-[19px] font-bold text-text-primary">{t('guide.cta.title')}</h2>
			<p class="text-[15px] leading-relaxed text-text-secondary">{t('guide.cta.desc')}</p>
			<a href="/new" class="btn btn-primary btn-md">{t('home.hero.cta')}</a>
		</section>
	</main>
</div>
