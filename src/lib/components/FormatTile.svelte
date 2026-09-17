<script lang="ts">
	import { t } from '$lib/i18n/index.js';
	import { txt } from '$lib/content/localized.js';
	import { formatArtBackground } from '$lib/format-art.js';
	import type { RetroFormat } from '$lib/content/formats.js';

	// Плитка-ссылка на страницу формата с иллюстрацией фоном: /formats (meta — чипы
	// «минуты · люди · колонки»), главная, /how-to-run-a-retro. Всё поверх картинки — art-токены.
	// С md: высота от 168 → иллюстрация ≈280 + зазор 20, отсюда текст max-w 100% − 300px.
	// До md картинка лентой под текстом (.format-art-stack)
	let { format, meta = false, style }: { format: RetroFormat; meta?: boolean; style?: string } = $props();
</script>

<a
	href="/formats/{format.slug}"
	data-testid="format-tile"
	data-format={format.slug}
	class="format-art format-art-stack card-interactive flex flex-col gap-2 p-5 md:min-h-[168px] md:p-6"
	style:background-image={formatArtBackground(format.slug)}
	{style}
>
	<span class="font-heading text-[17px] font-bold leading-[1.3] text-art-ink md:max-w-[calc(100%-300px)]">{txt(format.name)}</span>
	<span class="text-sm leading-relaxed text-art-ink-secondary md:max-w-[calc(100%-300px)]">{txt(format.tagline)}</span>
	{#if meta}
		<span class="mt-1 flex flex-wrap gap-1.5 md:max-w-[calc(100%-300px)]">
			<span class="badge border border-art-chip-border bg-art-chip text-art-ink-secondary">{t('formats.meta.minutes', { n: format.minutes })}</span>
			<span class="badge border border-art-chip-border bg-art-chip text-art-ink-secondary">{txt(format.teamSize)}</span>
			<span class="badge border border-art-chip-border bg-art-chip text-art-ink-secondary">{t('formats.meta.columns', { n: format.columns.length })}</span>
		</span>
	{/if}
</a>
