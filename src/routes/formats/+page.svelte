<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { t } from '$lib/i18n/index.js';
	import { FORMATS } from '$lib/content/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { SITE } from '$lib/seo.js';
	import { boardStore } from '$lib/stores/board.svelte.js';

	boardStore.board = null;

	// ItemList вместо простого списка ссылок: так поисковик понимает, что это
	// оглавление раздела, а не навигация сайта.
	let itemList = $derived({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: t('formats.heading'),
		itemListElement: FORMATS.map((f, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: txt(f.name),
			url: `${SITE}/formats/${f.slug}`
		}))
	});
</script>

<Seo title={t('formats.seo.title')} description={t('formats.seo.description')} path="/formats" />
<JsonLd data={itemList} />

<div class="min-h-screen bg-surface">
	<Header showNav showCreate />

	<main class="mx-auto flex max-w-[860px] flex-col gap-8 px-4 pb-20 pt-12 sm:px-8 sm:pt-14">
		<div class="flex flex-col gap-3">
			<h1 class="font-heading text-[26px] font-bold tracking-[-0.02em] text-text-primary sm:text-[32px]">
				{t('formats.heading')}
			</h1>
			<p class="max-w-[620px] text-base leading-relaxed text-text-secondary">
				{t('formats.subtitle')}
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			{#each FORMATS as format, i (format.slug)}
				<a
					href="/formats/{format.slug}"
					class="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-card p-5 transition-colors hover:bg-surface-hover sm:p-6"
					style="animation: fadeUp 0.5s cubic-bezier(0.25, 1, 0.5, 1) {Math.min(i, 5) * 0.08}s both;"
				>
					<span class="font-heading text-[18px] font-bold text-text-primary">{txt(format.name)}</span>
					<span class="text-sm leading-relaxed text-text-secondary">{txt(format.tagline)}</span>
					<div class="mt-1 flex flex-wrap gap-1.5">
						<span class="rounded-full border border-border bg-surface px-2.5 py-[3px] text-xs font-semibold text-text-secondary">
							{t('formats.meta.minutes', { n: format.minutes })}
						</span>
						<span class="rounded-full border border-border bg-surface px-2.5 py-[3px] text-xs font-semibold text-text-secondary">
							{txt(format.teamSize)}
						</span>
						<span class="rounded-full border border-border bg-surface px-2.5 py-[3px] text-xs font-semibold text-text-secondary">
							{t('formats.meta.columns', { n: format.columns.length })}
						</span>
					</div>
				</a>
			{/each}
		</div>

		<section class="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface-card p-6">
			<h2 class="font-heading text-[19px] font-bold text-text-primary">{t('formats.cta.title')}</h2>
			<p class="text-[15px] leading-relaxed text-text-secondary">{t('formats.cta.desc')}</p>
			<a href="/new" class="btn btn-primary btn-md">{t('home.hero.cta')}</a>
		</section>
	</main>
</div>
