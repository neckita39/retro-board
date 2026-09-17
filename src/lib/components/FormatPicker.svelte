<script lang="ts">
	import { VISIBLE_FORMATS, TONE } from '$lib/formats.js';
	import { FORMATS } from '$lib/content/formats.js';
	import { txt } from '$lib/content/localized.js';
	import { formatArtBackground } from '$lib/format-art.js';
	import { t } from '$lib/i18n/index.js';

	let { value = $bindable('classic'), compact = false }: { value?: string; compact?: boolean } = $props();

	// Название и подпись: классика — из словаря, остальные — со страниц форматов
	function meta(id: string) {
		if (id === 'classic') return { name: t('format.classic.name'), desc: t('format.classic.desc'), page: null };
		const seo = FORMATS.find((f) => f.slug === id);
		return {
			name: seo ? txt(seo.short) : id,
			desc: seo ? txt(seo.tagline) : '',
			page: seo ? `/formats/${seo.slug}` : null
		};
	}

	// Иллюстрация — правые 56 % картинки 3:1, ≈1.68 × высоты картинки, поэтому текст ограничен
	// шириной «всё минус иллюстрация». Полный вариант (/new): картинка по высоте варианта,
	// min-h 112 → иллюстрация ≈185 + зазор ≈20 = 204; до sm картинка уходит в правый нижний
	// угол (.format-art-foot), и ограничение снимается. Компактная строка (модалка): картинка
	// всегда 48px (.format-art-row) → иллюстрация ≈81 + зазор = 86 на любой ширине. Самая
	// длинная строка (RU «Классическая» + «Рекомендуем», 302px) ещё входит в 390 − 86 = 304px
	// модалки; при 96 она переносится и на десктопе
	const text = $derived(compact ? 'max-w-[calc(100%-86px)]' : 'sm:max-w-[calc(100%-204px)]');
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-2 text-sm font-semibold text-text-primary">{t('new.format.title')}</legend>
	<div class="grid gap-2">
		{#each VISIBLE_FORMATS as format (format.id)}
			{@const m = meta(format.id)}
			<!-- Выбрано = рамка 2px терракотой (граница + внутренняя тень), как у карточек типа на /new.
			     Фон — картинка формата: внутренняя тень рисуется поверх background-image -->
			<label
				data-testid="format-option"
				data-format={format.id}
				class="format-art relative flex cursor-pointer flex-col gap-2 transition-colors {compact
					? 'format-art-row p-3'
					: 'format-art-foot p-4 sm:min-h-[112px]'} {value === format.id
					? 'border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]'
					: 'border-border hover:border-border-strong'}"
				style:background-image={formatArtBackground(format.id)}
			>
				<input type="radio" name="format" value={format.id} bind:group={value} class="sr-only" />
				<div class="flex flex-wrap items-center gap-2 {text}">
					<div class="flex gap-1" aria-hidden="true">
						{#each format.columns as col (col.id)}
							<div class="h-5 w-2.5 rounded-[3px] {TONE[col.tone].art}"></div>
						{/each}
					</div>
					<span class="font-heading text-[15px] font-bold text-art-ink">{m.name}</span>
					{#if format.id === 'classic'}
						<span class="badge-sm bg-art-accent-bg text-art-accent">{t('format.recommended')}</span>
					{/if}
				</div>
				{#if !compact}
					<p class="text-[13px] leading-[1.5] text-art-ink-secondary {text}">{m.desc}</p>
					{#if m.page}
						<a href={m.page} class="self-start text-[13px] font-semibold text-art-accent hover:underline max-sm:absolute max-sm:bottom-4 max-sm:left-4" onclick={(e) => e.stopPropagation()}>{t('new.format.more')}</a>
					{/if}
				{/if}
			</label>
		{/each}
	</div>
</fieldset>
