<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
</script>

<svelte:head>
	<title>{t('apiDocs.title')} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header showCreate={true} />

	<main class="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
		<h1 class="font-heading text-3xl font-bold tracking-tight text-text-primary">{t('apiDocs.title')}</h1>
		<p class="mt-2 text-text-secondary">{t('apiDocs.subtitle')}</p>

		<p class="mt-6 text-sm leading-relaxed text-text-secondary">{t('apiDocs.intro')}</p>

		<div class="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
			<strong>{t('apiDocs.security.title')}.</strong>
			{t('apiDocs.security.desc')}
		</div>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.endpoints.title')}</h2>

		<div class="mt-4 space-y-6">
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<span class="badge-sm badge-accent">GET</span>
					<code class="text-[13px] font-semibold text-text-primary">/api/v1/boards/&#123;boardId&#125;/export.md</code>
				</div>
				<p class="mt-1.5 text-sm text-text-secondary">{t('apiDocs.md.desc')}</p>
			</div>
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<span class="badge-sm badge-accent">GET</span>
					<code class="text-[13px] font-semibold text-text-primary">/api/v1/boards/&#123;boardId&#125;/export.json</code>
				</div>
				<p class="mt-1.5 text-sm text-text-secondary">{t('apiDocs.json.desc')}</p>
			</div>
		</div>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.params.title')}</h2>
		<p class="mt-2 text-sm text-text-secondary">
			<code class="rounded bg-surface-hover px-1.5 py-0.5 text-[12px]">?lang=en|ru</code>
			— {t('apiDocs.params.lang')}
		</p>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.example.title')}</h2>
		<pre class="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-card p-4 text-[12px] leading-relaxed text-text-primary"><code>curl https://retrospectrix.ru/api/v1/boards/V1StGXR8_Z5jdHi6B-myT/export.md

# Sprint 42

## Went Well

- CI is finally green — *Maria* [3 likes]
  - Huge relief! — *Peter*</code></pre>

		<h2 class="font-heading mt-10 text-lg font-bold text-text-primary">{t('apiDocs.limits.title')}</h2>
		<ul class="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">
			<li>{t('apiDocs.limits.rate')}</li>
			<li>{t('apiDocs.limits.notfound')}</li>
		</ul>

		<a href="/" class="mt-10 inline-block text-[13px] font-medium text-accent transition-colors hover:text-accent-hover">{t('apiDocs.back')}</a>
	</main>
</div>
