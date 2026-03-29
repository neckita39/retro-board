<script lang="ts">
	import { fly } from 'svelte/transition';
	import { t } from '$lib/i18n/index.js';

	let { adminLink, titleKey = 'admin.banner.title', copyKey = 'admin.banner.copy' }: { adminLink: string; titleKey?: string; copyKey?: string } = $props();

	let visible = $state(true);
	let copied = $state(false);

	$effect(() => {
		if (typeof window !== 'undefined') {
			const clean = new URL(window.location.href);
			clean.searchParams.delete('admin');
			history.replaceState({}, '', clean.toString());
		}
	});

	$effect(() => {
		if (visible) {
			const timer = setTimeout(() => { visible = false; }, 15000);
			return () => clearTimeout(timer);
		}
	});

	async function copy() {
		// Copy the public URL (admin param already stripped from URL)
		await navigator.clipboard.writeText(window.location.href);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

{#if visible}
	<div
		transition:fly={{ y: 20, duration: 400, easing: (t) => 1 - Math.pow(1 - t, 3) }}
		class="fixed bottom-6 left-1/2 z-[400] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-surface-card px-4 py-3 shadow-xl"
	>
		<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
			<svg class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<rect width="18" height="11" x="3" y="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		</div>
		<span class="whitespace-nowrap text-[13px] font-semibold text-text-primary">{t(titleKey)}</span>
		<button
			onclick={copy}
			class="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95
				{copied
					? 'bg-well text-white'
					: 'bg-accent text-white hover:bg-accent-hover'}"
		>
			{copied ? t('copy.copied') : t(copyKey)}
		</button>
		<button
			onclick={() => (visible = false)}
			class="btn-icon btn-icon-sm shrink-0"
			aria-label={t('admin.banner.close')}
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>
{/if}
