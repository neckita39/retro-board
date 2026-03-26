<script lang="ts">
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.js';

	const COOKIE_KEY = 'retro_onboarding_seen';

	let visible = $state(false);

	if (browser) {
		const seen = localStorage.getItem(COOKIE_KEY);
		if (!seen) {
			visible = true;
		}
	}

	function dismiss() {
		visible = false;
		if (browser) {
			localStorage.setItem(COOKIE_KEY, '1');
		}
	}
</script>

{#if visible}
	<div
		class="border-b border-border bg-surface-hover px-4 py-2 transition-all duration-300 sm:px-6"
		style="animation: fadeUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);"
	>
		<div class="mx-auto flex max-w-7xl items-center gap-2.5">
			<div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-text-primary text-[11px] font-bold text-surface">
				?
			</div>
			<span class="min-w-0 flex-1 text-[13px] text-text-secondary">{t('onboarding.tip')}</span>
			<button
				onclick={dismiss}
				class="shrink-0 rounded-lg bg-text-primary px-3 py-1 text-[12px] font-semibold text-surface transition-opacity hover:opacity-85 active:scale-95"
			>
				{t('onboarding.done')}
			</button>
		</div>
	</div>
{/if}
