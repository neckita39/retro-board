<script lang="ts">
	import { BOARD_FORMATS, TONE } from '$lib/formats.js';
	import { FORMATS } from '$lib/content/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	let { value = $bindable('classic'), compact = false }: { value?: string; compact?: boolean } = $props();

	// Название и подпись: классика — из словаря, остальные — со страниц форматов
	function meta(id: string) {
		if (id === 'classic') return { name: t('format.classic.name'), desc: t('format.classic.desc'), page: null };
		const seo = FORMATS.find((f) => f.slug === id);
		return {
			name: seo ? txt(seo.name) : id,
			desc: seo ? txt(seo.tagline) : '',
			page: seo ? `/formats/${seo.slug}` : null
		};
	}
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 text-sm font-semibold text-text-primary">{t('new.format.title')}</legend>
	<div class="grid gap-2 {compact ? '' : 'sm:grid-cols-2'}">
		{#each BOARD_FORMATS as format (format.id)}
			{@const m = meta(format.id)}
			<label
				class="relative flex cursor-pointer flex-col gap-2 rounded-2xl bg-surface-card p-4 transition-all {value === format.id
					? 'outline outline-2 outline-accent'
					: 'border border-border hover:border-border-strong'}"
			>
				<input type="radio" name="format" value={format.id} bind:group={value} class="sr-only" />
				<div class="flex flex-wrap items-center gap-2">
					<div class="flex gap-1" aria-hidden="true">
						{#each format.columns as col (col.id)}
							<div class="h-5 w-2.5 rounded {TONE[col.tone].bar}"></div>
						{/each}
					</div>
					<span class="font-heading text-[15px] font-bold text-text-primary">{m.name}</span>
					{#if format.id === 'classic'}
						<span class="badge-sm bg-accent-bg text-accent">{t('format.recommended')}</span>
					{/if}
				</div>
				{#if !compact}
					<p class="text-[13px] leading-relaxed text-text-secondary">{m.desc}</p>
					{#if m.page}
						<a href={m.page} class="text-[13px] font-semibold text-accent hover:underline" onclick={(e) => e.stopPropagation()}>{t('new.format.more')}</a>
					{/if}
				{/if}
			</label>
		{/each}
	</div>
</fieldset>
