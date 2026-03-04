<script lang="ts">
	import { t } from '$lib/i18n/index.js';

	let { adminLink, titleKey = 'admin.banner.title', descKey = 'admin.banner.desc', copyKey = 'admin.banner.copy' }: { adminLink: string; titleKey?: string; descKey?: string; copyKey?: string } = $props();

	let visible = $state(true);
	let copied = $state(false);

	$effect(() => {
		// Remove ?admin=... from URL without triggering navigation
		if (typeof window !== 'undefined') {
			const clean = new URL(window.location.href);
			clean.searchParams.delete('admin');
			history.replaceState({}, '', clean.toString());
		}
	});

	async function copy() {
		await navigator.clipboard.writeText(adminLink);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

{#if visible}
	<div class="border-b border-amber-200 bg-amber-50 px-4 py-3 transition-colors dark:border-amber-800/40 dark:bg-amber-950/20">
		<div class="mx-auto flex max-w-7xl items-start gap-3">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0 text-amber-500">
				<path d="M11 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>
				<path d="M16 3h5v5"/>
				<path d="M21 3l-9 9"/>
				<path d="M21 13v7a2 2 0 0 1-2 2h-5"/>
			</svg>
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<div>
					<p class="text-sm font-semibold text-amber-900 dark:text-amber-200">{t(titleKey)}</p>
					<p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{t(descKey)}</p>
				</div>
				<div class="flex items-center gap-2">
					<input
						type="text"
						readonly
						value={adminLink}
						onclick={(e) => (e.target as HTMLInputElement).select()}
						class="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-xs text-text-primary dark:border-amber-700/50 dark:bg-surface-card"
					/>
					<button
						onclick={copy}
						class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {copied
							? 'bg-emerald-500 text-white'
							: 'bg-amber-500 text-white hover:bg-amber-600'}"
					>
						{copied ? t('copy.copied') : t(copyKey)}
					</button>
				</div>
				<p class="text-xs text-amber-600 dark:text-amber-500">{t('admin.banner.saved')}</p>
			</div>
			<button
				onclick={() => (visible = false)}
				class="shrink-0 rounded p-1 text-amber-500 transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/30"
				aria-label={t('admin.banner.close')}
				title={t('admin.banner.close')}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"/>
					<line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		</div>
	</div>
{/if}
