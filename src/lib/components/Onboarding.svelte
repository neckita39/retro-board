<script lang="ts">
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.js';

	const COOKIE_KEY = 'retro_onboarding_seen';

	let visible = $state(false);
	let step = $state(1);

	const steps = [
		{ title: 'onboarding.share.title', desc: 'onboarding.share.desc' },
		{ title: 'onboarding.cards.title', desc: 'onboarding.cards.desc' },
		{ title: 'onboarding.vote.title', desc: 'onboarding.vote.desc' }
	];

	if (browser) {
		const seen = localStorage.getItem(COOKIE_KEY);
		if (!seen) {
			visible = true;
		}
	}

	function next() {
		if (step < steps.length) {
			step++;
		} else {
			dismiss();
		}
	}

	function dismiss() {
		visible = false;
		if (browser) {
			localStorage.setItem(COOKIE_KEY, '1');
		}
	}

	let current = $derived(steps[step - 1]);
	let isLast = $derived(step === steps.length);
</script>

{#if visible}
	<div
		class="border-b border-border bg-surface-hover px-4 py-2.5 transition-all duration-300 sm:px-6"
		style="animation: fadeUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);"
	>
		<div class="mx-auto flex max-w-7xl items-center gap-3">
			<!-- Step number -->
			<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-text-primary text-[11px] font-bold text-surface">
				{step}
			</div>

			<!-- Text -->
			<div class="min-w-0 flex-1">
				<span class="text-[13px] font-semibold text-text-primary">{t(current.title)}</span>
				<span class="ml-1.5 text-[12px] text-text-secondary">{t(current.desc)}</span>
			</div>

			<!-- Progress dots -->
			<div class="flex gap-1 px-2">
				{#each steps as _, i}
					<div class="h-1.5 w-1.5 rounded-full transition-colors duration-200 {i < step ? 'bg-text-primary' : 'bg-border-strong'}"></div>
				{/each}
			</div>

			<!-- Actions -->
			{#if isLast}
				<button
					onclick={dismiss}
					class="shrink-0 rounded-lg bg-text-primary px-3 py-1 text-[12px] font-semibold text-surface transition-opacity hover:opacity-85 active:scale-95"
				>
					{t('onboarding.done')}
				</button>
			{:else}
				<button
					onclick={next}
					class="shrink-0 rounded-lg border border-border px-3 py-1 text-[12px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary active:scale-95"
				>
					{t('onboarding.next')}
				</button>
				<button
					onclick={dismiss}
					class="shrink-0 text-[11px] text-text-muted hover:text-text-primary hover:underline"
				>
					{t('onboarding.skip')}
				</button>
			{/if}
		</div>
	</div>
{/if}
