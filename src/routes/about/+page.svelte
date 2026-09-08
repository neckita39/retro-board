<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { t } from '$lib/i18n/index.js';
	import { ABOUT_INTRO, ABOUT_STORY, ABOUT_PRINCIPLES, AUTHOR_NAME, AUTHOR_EMAIL } from '$lib/content/about.js';
	import { txt } from '$lib/content/localized.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';

	boardStore.board = null;

	let aboutPage = $derived({
		'@context': 'https://schema.org',
		'@type': 'AboutPage',
		name: t('about.seo.title'),
		description: t('about.seo.description'),
		author: {
			'@type': 'Person',
			name: txt(AUTHOR_NAME),
			email: AUTHOR_EMAIL
		}
	});
</script>

<Seo title={t('about.seo.title')} description={t('about.seo.description')} path="/about" />
<JsonLd data={aboutPage} />

<div class="min-h-screen bg-surface">
	<Header showNav showCreate />

	<main class="mx-auto flex max-w-[760px] flex-col gap-9 px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
		<header class="flex flex-col gap-3">
			<h1 class="font-heading text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary sm:text-[34px]">
				{t('about.heading')}
			</h1>
		</header>

		<p class="text-[17px] leading-[1.75] text-text-primary/90">{txt(ABOUT_INTRO)}</p>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('about.section.why')}</h2>
			{#each ABOUT_STORY as paragraph (paragraph.en)}
				<p class="text-[16px] leading-[1.7] text-text-primary/85">{txt(paragraph)}</p>
			{/each}
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('about.section.principles')}</h2>
			<div class="flex flex-col gap-3">
				{#each ABOUT_PRINCIPLES as item (item.title.en)}
					<div class="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface-card p-5">
						<h3 class="font-heading text-[16px] font-bold text-text-primary">{txt(item.title)}</h3>
						<p class="text-[15px] leading-[1.7] text-text-primary/85">{txt(item.body)}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="flex flex-col gap-3">
			<h2 class="font-heading text-[21px] font-bold text-text-primary">{t('about.section.author')}</h2>
			<p class="text-[16px] leading-[1.7] text-text-primary/85">
				{t('about.author.desc', { name: txt(AUTHOR_NAME) })}
			</p>
			<p class="text-[16px] leading-[1.7] text-text-primary/85">
				<a href="mailto:{AUTHOR_EMAIL}" class="font-semibold text-accent hover:underline">{AUTHOR_EMAIL}</a>
				<span class="text-text-muted"> · </span>
				<button onclick={() => feedbackStore.show()} class="font-semibold text-accent hover:underline">
					{t('nav.feedback')}
				</button>
			</p>
		</section>

		<section class="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface-card p-6">
			<h2 class="font-heading text-[19px] font-bold text-text-primary">{t('guide.cta.title')}</h2>
			<p class="text-[15px] leading-relaxed text-text-secondary">{t('guide.cta.desc')}</p>
			<a href="/new" class="btn btn-primary btn-md">{t('home.hero.cta')}</a>
		</section>
	</main>
</div>
