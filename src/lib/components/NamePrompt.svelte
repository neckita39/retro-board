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

<!-- Имя и подсказка — одна карточка, в той же сетке и с теми же отступами, что колонки доски -->
{#if visible}
	<div class="card-enter px-4 pt-4 sm:px-7">
		<div class="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-surface-card px-4 py-3">
			<!-- Серый кружок с силуэтом; после сохранения — чернильный аватар с буквой, как в шапке -->
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 {saved
					? 'bg-text-primary text-surface'
					: 'bg-surface-hover text-text-muted'}"
			>
				{#if saved}
					<span class="text-[13px] font-bold leading-none">{savedName[0].toUpperCase()}</span>
				{:else}
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				{/if}
			</div>

			<div class="flex min-w-0 flex-1 flex-col gap-[3px]">
				<span class="text-sm font-semibold leading-[1.3] text-text-primary">{t('name.title')}</span>
				<span class="text-[13px] leading-[1.4] text-text-secondary">{t('name.desc')}</span>
			</div>

			{#if saved}
				<div class="flex items-center gap-1.5 text-sm text-text-secondary">
					<svg class="h-3.5 w-3.5 text-well" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12" /></svg>
					{t('name.greeting', { name: savedName })}
				</div>
			{:else}
				<!-- На узком экране форма уезжает на свою строку и растягивается на всю ширину -->
				<div class="flex w-full min-w-0 items-center gap-2 sm:w-auto">
					<input
						type="text"
						bind:value={name}
						maxlength="30"
						placeholder={t('name.placeholder')}
						onkeydown={(e) => e.key === 'Enter' && save()}
						class="input input-md min-w-0 flex-1 sm:w-[220px] sm:flex-none"
					/>
					<button onclick={save} class="btn btn-dark btn-md">
						{t('name.save')}
					</button>
					<button
						onclick={skip}
						class="px-1 text-[13px] font-medium text-text-muted transition-colors hover:text-text-primary"
					>
						{t('name.skip')}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
