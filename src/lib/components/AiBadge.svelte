<script lang="ts">
	// Бейдж «AI-анализ»: семейство improve, звезда — та же, что на кнопке анализа.
	// label нужен только экрану создания, где хватает короткого «AI».
	import { t } from '$lib/i18n/index.js';

	let { label }: { label?: string } = $props();
</script>

<span class="badge-sm badge-ai shrink-0">
	<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>
	</svg>
	{label ?? t('analysis.badge')}
</span>
