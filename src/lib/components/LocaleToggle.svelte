<script lang="ts">
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { LOCALES, LOCALE_KEYS, type Locale } from '$lib/i18n/index.js';
	import { t } from '$lib/i18n/index.js';
</script>

<button
	onclick={() => localeStore.cycle()}
	class="flex h-9 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
	aria-label={t('tooltip.locale')}
	title={t('tooltip.locale')}
>
	{LOCALES[localeStore.locale].label}
</button>
