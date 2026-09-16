<script lang="ts">
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { LOCALES } from '$lib/i18n/index.js';
	import { t } from '$lib/i18n/index.js';
</script>

<button
	onclick={() => localeStore.cycle()}
	class="btn-icon btn-icon-lg btn-icon-bordered px-2 text-[13px] font-bold"
	aria-label={t('tooltip.locale')}
	title={t('tooltip.locale')}
>
	{LOCALES[localeStore.locale].label}
</button>
