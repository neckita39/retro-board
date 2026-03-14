<script lang="ts">
	import { t } from '$lib/i18n/index.js';

	let { adminLink, titleKey = 'admin.banner.title', descKey = 'admin.banner.desc', copyKey = 'admin.banner.copy' }: { adminLink: string; titleKey?: string; descKey?: string; copyKey?: string } = $props();

	let visible = $state(true);
	let copied = $state(false);

	$effect(() => {
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
	<div class="card-enter border-b border-border bg-surface-hover px-4 py-3">
		<div class="mx-auto flex max-w-7xl items-start gap-3">
			<svg class="mt-0.5 h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<rect width="18" height="11" x="3" y="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<div>
					<p class="text-sm font-semibold text-text-primary">{t(titleKey)}</p>
					<p class="mt-0.5 text-xs text-text-secondary">{t(descKey)}</p>
				</div>
				<div class="flex items-center gap-2">
					<input
						type="text"
						readonly
						value={adminLink}
						onclick={(e) => (e.target as HTMLInputElement).select()}
						class="min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none"
					/>
					<button
						onclick={copy}
						class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95
							{copied
								? 'bg-well text-white'
								: 'bg-text-primary text-surface hover:opacity-85'}"
					>
						{copied ? t('copy.copied') : t(copyKey)}
					</button>
				</div>
				<p class="text-xs text-text-muted">{t('admin.banner.saved')}</p>
			</div>
			<button
				onclick={() => (visible = false)}
				class="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
				aria-label={t('admin.banner.close')}
				title={t('admin.banner.close')}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	</div>
{/if}
