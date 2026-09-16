<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { t } from '$lib/i18n/index.js';
	import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '$lib/content/privacy.js';
	import { AUTHOR_EMAIL } from '$lib/content/about.js';
	import { txt } from '$lib/content/localized.js';
	import { boardStore } from '$lib/stores/board.svelte.js';

	boardStore.board = null;
</script>

<Seo title={t('privacy.seo.title')} description={t('privacy.seo.description')} path="/privacy" />

<div class="min-h-screen bg-surface">
	<Header showNav showCreate />

	<main class="mx-auto flex max-w-[760px] flex-col gap-9 px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
		<header class="flex flex-col gap-3">
			<h1 class="font-heading text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-text-primary sm:text-[34px]">
				{t('privacy.heading')}
			</h1>
			<span class="text-[13px] text-text-muted">{t('privacy.updated', { date: PRIVACY_UPDATED })}</span>
		</header>

		<p class="text-[17px] leading-[1.75] text-text-primary">{txt(PRIVACY_INTRO)}</p>

		<div class="flex flex-col gap-6">
			{#each PRIVACY_SECTIONS as section (section.title.en)}
				<section class="flex flex-col gap-2">
					<h2 class="font-heading text-[19px] font-bold text-text-primary">{txt(section.title)}</h2>
					<p class="text-[16px] leading-[1.7] text-text-primary">{txt(section.body)}</p>
				</section>
			{/each}
		</div>

		<p class="text-[15px] leading-[1.7] text-text-secondary">
			{t('privacy.contact')}
			<a href="mailto:{AUTHOR_EMAIL}" class="font-semibold text-accent hover:underline">{AUTHOR_EMAIL}</a>
		</p>
	</main>
</div>
