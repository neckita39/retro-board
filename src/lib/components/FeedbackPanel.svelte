<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { t } from '$lib/i18n/index.js';
	import { feedbackStore } from '$lib/stores/feedback.svelte.js';

	let name = $state('');
	let message = $state('');
	let status = $state<'idle' | 'sending' | 'success' | 'error'>('idle');

	async function submit() {
		if (!message.trim()) return;
		status = 'sending';
		try {
			const res = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), message: message.trim() })
			});
			if (!res.ok) throw new Error();
			status = 'success';
			name = '';
			message = '';
		} catch {
			status = 'error';
		}
	}

	function close() {
		feedbackStore.hide();
		setTimeout(() => { status = 'idle'; }, 350);
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && feedbackStore.open && close()} />

{#if feedbackStore.open}
	<!-- Overlay -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-[600] bg-black/30 backdrop-blur-sm"
		onclick={close}
	></div>

	<!-- Panel -->
	<div
		transition:fly={{ x: 400, duration: 350, easing: (t) => 1 - Math.pow(1 - t, 3) }}
		class="fixed right-0 top-0 bottom-0 z-[601] flex w-full max-w-[400px] flex-col border-l border-border bg-surface-card shadow-2xl"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border px-5 py-4">
			<h2 class="text-lg font-bold text-text-primary">{t('feedback.title')}</h2>
			<button
				onclick={close}
				class="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
			</button>
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto px-5 py-5">
			{#if status === 'success'}
				<div class="flex flex-col items-center justify-center py-12 text-center" style="animation: fadeUp 0.5s cubic-bezier(0.25,1,0.5,1) both;">
					<div class="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
						<svg class="h-7 w-7 text-accent badge-pop" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
					</div>
					<p class="text-lg font-bold text-text-primary">{t('feedback.success')}</p>
					<button
						onclick={() => (status = 'idle')}
						class="mt-6 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
					>
						{t('feedback.another')}
					</button>
				</div>
			{:else}
				<p class="mb-5 text-sm text-text-secondary">{t('feedback.subtitle')}</p>

				<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="flex flex-col gap-4">
					<div>
						<label for="fp-name" class="mb-1.5 block text-sm font-medium text-text-secondary">{t('feedback.name')}</label>
						<input
							id="fp-name"
							type="text"
							bind:value={name}
							maxlength="100"
							placeholder={t('feedback.name.placeholder')}
							class="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
						/>
					</div>

					<div>
						<label for="fp-message" class="mb-1.5 block text-sm font-medium text-text-secondary">{t('feedback.message')} <span class="text-red-400">*</span></label>
						<textarea
							id="fp-message"
							bind:value={message}
							required
							maxlength="2000"
							rows="5"
							placeholder={t('feedback.message.placeholder')}
							class="w-full resize-none rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
						></textarea>
					</div>

					{#if status === 'error'}
						<div class="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-900/20">
							<svg class="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
							<span class="text-sm text-red-600 dark:text-red-400">{t('feedback.error')}</span>
						</div>
					{/if}

					<button
						type="submit"
						disabled={!message.trim() || status === 'sending'}
						class="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-50 active:scale-[0.98]"
					>
						{#if status === 'sending'}
							<span class="inline-flex items-center gap-2">
								<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
								{t('feedback.sending')}
							</span>
						{:else}
							{t('feedback.send')}
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
