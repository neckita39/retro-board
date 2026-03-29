<script lang="ts">
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.js';

	let visible = $state(false);
	let name = $state('');
	let saved = $state(false);
	let savedName = $state('');

	if (browser) {
		const stored = localStorage.getItem('retro_name');
		if (!stored) {
			visible = true;
		}
	}

	function save() {
		const trimmed = name.trim();
		if (!trimmed) return;
		localStorage.setItem('retro_name', trimmed);
		savedName = trimmed;
		saved = true;
		setTimeout(() => (visible = false), 2200);
	}

	function skip() {
		localStorage.setItem('retro_name', '');
		visible = false;
	}
</script>

{#if visible}
	<div class="mx-auto max-w-[1100px] px-5 py-2 card-enter" class:opacity-0={!visible} style="transition: opacity 0.4s, max-height 0.4s; {!visible ? 'max-height: 0; overflow: hidden;' : ''}">
		<div class="flex items-center gap-3 rounded-lg border border-border bg-surface-hover px-3.5 py-2.5">
			<!-- Avatar -->
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300
				{saved ? 'bg-text-primary' : 'border border-border bg-surface-hover'}">
				{#if saved}
					<span class="text-base font-bold text-surface">{savedName[0].toUpperCase()}</span>
				{:else}
					<svg class="h-[18px] w-[18px] text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				{/if}
			</div>

			<!-- Text -->
			<div class="min-w-0 flex-1">
				<div class="text-[13px] font-semibold text-text-primary">{t('name.title')}</div>
				<div class="text-[11px] text-text-muted">{t('name.desc')}</div>
			</div>

			<!-- Form / Success -->
			{#if saved}
				<div class="flex items-center gap-1.5 text-sm text-text-secondary">
					<svg class="h-3.5 w-3.5 text-well" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
					{t('name.greeting', { name: savedName })}
				</div>
			{:else}
				<div class="flex shrink-0 items-center gap-2">
					<input
						type="text"
						bind:value={name}
						maxlength="30"
						placeholder={t('name.placeholder')}
						onkeydown={(e) => e.key === 'Enter' && save()}
						class="input input-md w-44"
					/>
					<button
						onclick={save}
						class="btn btn-dark btn-sm"
					>
						{t('name.save')}
					</button>
					<button
						onclick={skip}
						class="text-xs text-text-muted hover:text-text-primary hover:underline"
					>
						{t('name.skip')}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
