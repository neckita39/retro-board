<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { t } from '$lib/i18n/index.js';

	interface Endpoint {
		id: string;
		method: 'GET';
		path: string;
		titleKey: string;
		descKey: string;
	}

	const endpoints: Endpoint[] = [
		{
			id: 'md',
			method: 'GET',
			path: '/api/v1/boards/{boardId}/export.md',
			titleKey: 'apiDocs.md.title',
			descKey: 'apiDocs.md.desc'
		},
		{
			id: 'json',
			method: 'GET',
			path: '/api/v1/boards/{boardId}/export.json',
			titleKey: 'apiDocs.json.title',
			descKey: 'apiDocs.json.desc'
		},
		{
			id: 'space-boards-md',
			method: 'GET',
			path: '/api/v1/spaces/{spaceId}/boards.md',
			titleKey: 'apiDocs.spaceBoards.md.title',
			descKey: 'apiDocs.spaceBoards.md.desc'
		},
		{
			id: 'space-boards-json',
			method: 'GET',
			path: '/api/v1/spaces/{spaceId}/boards.json',
			titleKey: 'apiDocs.spaceBoards.json.title',
			descKey: 'apiDocs.spaceBoards.json.desc'
		},
		{
			id: 'space-analyses-md',
			method: 'GET',
			path: '/api/v1/spaces/{spaceId}/analyses.md',
			titleKey: 'apiDocs.spaceAnalyses.md.title',
			descKey: 'apiDocs.spaceAnalyses.md.desc'
		},
		{
			id: 'space-analyses-json',
			method: 'GET',
			path: '/api/v1/spaces/{spaceId}/analyses.json',
			titleKey: 'apiDocs.spaceAnalyses.json.title',
			descKey: 'apiDocs.spaceAnalyses.json.desc'
		}
	];

	// В списке слева: без префикса /api/v1/ и с «…» вместо id
	const shortPath = (path: string) => path.replace('/api/v1/', '').replace(/\{[a-zA-Z]+\}/, '…');
	const isMarkdown = (path: string) => path.endsWith('.md');
	const isSpace = (path: string) => path.includes('/spaces/');

	let selectedId = $state('md');
	let selected = $derived(endpoints.find((e) => e.id === selectedId) ?? endpoints[0]);
	let copied = $state(false);

	async function copyUrl() {
		await navigator.clipboard.writeText(`${window.location.origin}${selected.path}`);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<Seo
	title="{t('apiDocs.title')} — {t('header.brand')}"
	description={t('apiDocs.seo.description')}
	path="/api"
/>

<div class="flex min-h-screen flex-col">
	<Header showNav showCreate />

	<main class="mx-auto grid w-full max-w-[1100px] flex-1 gap-8 px-4 pb-20 pt-10 sm:px-8 sm:pt-12 lg:grid-cols-[280px_1fr] lg:gap-10">
		<!-- Endpoint list -->
		<div class="flex flex-col gap-1.5">
			<span class="px-3 pb-2 text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{t('apiDocs.endpoints.title')}</span>
			{#each endpoints as endpoint (endpoint.id)}
				<button
					onclick={() => (selectedId = endpoint.id)}
					aria-pressed={selectedId === endpoint.id}
					class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors {selectedId === endpoint.id
						? 'border border-border bg-surface-card'
						: 'border border-transparent hover:bg-surface-hover'}"
				>
					<span class="rounded-md bg-well-bg px-[7px] py-[3px] text-[11px] font-extrabold text-well-strong">{endpoint.method}</span>
					<span class="min-w-0 truncate font-mono text-[13px] {selectedId === endpoint.id ? 'font-semibold text-text-primary' : 'text-text-secondary'}">{shortPath(endpoint.path)}</span>
				</button>
			{/each}
		</div>

		<!-- Endpoint details -->
		<div class="flex min-w-0 flex-col gap-5">
			<div class="flex flex-col gap-2">
				<h1 class="font-heading text-[22px] font-bold tracking-[-0.02em] text-text-primary sm:text-[26px]">{t(selected.titleKey)}</h1>
				<p class="max-w-[560px] text-[15px] leading-relaxed text-text-secondary">{t(selected.descKey)}</p>
			</div>

			<!-- Request line -->
			<div class="flex items-center gap-3 rounded-xl border border-border bg-surface-card px-4 py-3">
				<span class="shrink-0 rounded-md bg-well-bg px-[9px] py-1 text-xs font-extrabold text-well-strong">{selected.method}</span>
				<span class="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-text-primary">{selected.path}</span>
				<button onclick={copyUrl} class="btn btn-secondary btn-sm shrink-0">
					{copied ? t('header.share.copied') : t('apiDocs.copy')}
				</button>
			</div>

			<!-- Example response — dark code block -->
			<div class="overflow-x-auto rounded-2xl bg-code-bg px-6 py-[22px]">
				{#if selected.id === 'md'}
					<pre class="font-mono text-[13px] leading-[1.7] text-code-fg"><code><span class="text-code-key"># Sprint 42</span>

<span class="text-code-key">## Went Well</span>

- CI is finally green — <span class="text-code-string">*Maria*</span> [<span class="text-code-number">3</span> likes]
  - Huge relief! — <span class="text-code-string">*Peter*</span></code></pre>
				{:else if selected.id === 'space-boards-md'}
					<pre class="font-mono text-[13px] leading-[1.7] text-code-fg"><code><span class="text-code-key"># Team Alpha</span>

- [Sprint 42](https://retrospectrix.ru/V1StGXR8_Z5jdHi6B-myT) — 2026-09-16 · classic
- [Space analysis for 16.09.2026](https://retrospectrix.ru/3fJ9…) — 2026-09-16 · analysis</code></pre>
				{:else if selected.id === 'space-boards-json'}
					<pre class="font-mono text-[13px] leading-[1.7] text-code-fg"><code>{'{'}
  <span class="text-code-key">"space"</span>: {'{'} <span class="text-code-key">"slug"</span>: <span class="text-code-string">"sP4c3…"</span>, <span class="text-code-key">"name"</span>: <span class="text-code-string">"Team Alpha"</span> {'}'},
  <span class="text-code-key">"boards"</span>: [
    {'{'}
      <span class="text-code-key">"slug"</span>: <span class="text-code-string">"V1StGXR8_Z5jdHi6B-myT"</span>,
      <span class="text-code-key">"title"</span>: <span class="text-code-string">"Sprint 42"</span>,
      <span class="text-code-key">"format"</span>: <span class="text-code-string">"classic"</span>,
      <span class="text-code-key">"createdAt"</span>: <span class="text-code-string">"2026-09-16T10:00:00.000Z"</span>,
      <span class="text-code-key">"url"</span>: <span class="text-code-string">"https://retrospectrix.ru/V1StGXR8_Z5jdHi6B-myT"</span>
    {'}'}
  ]
{'}'}</code></pre>
				{:else if selected.id === 'space-analyses-md'}
					<pre class="font-mono text-[13px] leading-[1.7] text-code-fg"><code><span class="text-code-key"># Team Alpha — AI analyses</span>

<span class="text-code-key">## Space analysis for 16.09.2026</span>

<span class="text-code-key">### Still bad</span>

- Flaky tests keep blocking merges (in 3 boards) — <span class="text-code-string">*AI analysis*</span></code></pre>
				{:else if selected.id === 'space-analyses-json'}
					<pre class="font-mono text-[13px] leading-[1.7] text-code-fg"><code>{'{'}
  <span class="text-code-key">"space"</span>: {'{'} <span class="text-code-key">"slug"</span>: <span class="text-code-string">"sP4c3…"</span>, <span class="text-code-key">"name"</span>: <span class="text-code-string">"Team Alpha"</span> {'}'},
  <span class="text-code-key">"analyses"</span>: [
    {'{'}
      <span class="text-code-key">"board"</span>: {'{'} <span class="text-code-key">"slug"</span>: <span class="text-code-string">"3fJ9…"</span>, <span class="text-code-key">"title"</span>: <span class="text-code-string">"Space analysis for 16.09.2026"</span>, <span class="text-code-key">"format"</span>: <span class="text-code-string">"analysis"</span> {'}'},
      <span class="text-code-key">"columns"</span>: {'{'}
        <span class="text-code-key">"again_bad"</span>: [ {'{'} <span class="text-code-key">"content"</span>: <span class="text-code-string">"Flaky tests keep blocking merges (in 3 boards)"</span>, <span class="text-code-key">"authorName"</span>: <span class="text-code-string">"AI analysis"</span> {'}'} ]
      {'}'}
    {'}'}
  ]
{'}'}</code></pre>
				{:else}
					<pre class="font-mono text-[13px] leading-[1.7] text-code-fg"><code>{'{'}
  <span class="text-code-key">"board"</span>: {'{'}
    <span class="text-code-key">"slug"</span>: <span class="text-code-string">"V1StGXR8_Z5jdHi6B-myT"</span>,
    <span class="text-code-key">"title"</span>: <span class="text-code-string">"Sprint 42"</span>,
    <span class="text-code-key">"format"</span>: <span class="text-code-string">"classic"</span>
  {'}'},
  <span class="text-code-key">"columns"</span>: {'{'}
    <span class="text-code-key">"went_well"</span>: [
      {'{'}
        <span class="text-code-key">"content"</span>: <span class="text-code-string">"CI is finally green"</span>,
        <span class="text-code-key">"authorName"</span>: <span class="text-code-string">"Maria"</span>,
        <span class="text-code-key">"likes"</span>: <span class="text-code-number">3</span>,
        <span class="text-code-key">"dislikes"</span>: <span class="text-code-number">0</span>
      {'}'}
    ]
  {'}'}
{'}'}</code></pre>
				{/if}
			</div>

			<!-- Access note -->
			<div class="rounded-xl border border-border bg-surface-card px-4 py-3 text-sm leading-relaxed text-text-secondary">
				<strong class="text-text-primary">{t('apiDocs.security.title')}.</strong>
				{t('apiDocs.security.desc')}
			</div>

			<p class="text-sm leading-relaxed text-text-secondary">{t('apiDocs.format.note')}</p>

			<!-- Parameters -->
			{#if isMarkdown(selected.path) || isSpace(selected.path)}
				<div class="flex flex-col gap-2">
					<h2 class="font-heading text-base font-bold text-text-primary">{t('apiDocs.params.title')}</h2>
					{#if isMarkdown(selected.path)}
						<p class="text-sm text-text-secondary">
							<code class="rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-[12px] text-text-primary">?lang=en|ru</code>
							— {t('apiDocs.params.lang')}
						</p>
					{/if}
					{#if isSpace(selected.path)}
						<p class="text-sm text-text-secondary">
							<code class="rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-[12px] text-text-primary">X-Space-Password</code>
							— {t('apiDocs.params.password')}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Limits -->
			<div class="flex flex-col gap-2">
				<h2 class="font-heading text-base font-bold text-text-primary">{t('apiDocs.limits.title')}</h2>
				<ul class="list-disc space-y-1 pl-[18px] text-sm leading-relaxed text-text-secondary marker:text-text-muted">
					<li>{t('apiDocs.limits.rate')}</li>
					<li>{t('apiDocs.limits.notfound')}</li>
					<li>{t('apiDocs.limits.password')}</li>
				</ul>
			</div>
		</div>
	</main>
</div>
