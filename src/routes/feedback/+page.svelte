<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';

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
</script>

<svelte:head>
	<title>{t('feedback.title')} — {t('header.brand')}</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<Header />

	<main class="flex flex-1 items-center justify-center px-6 py-20">
		<div class="w-full max-w-lg" style="animation: fadeUp 0.8s cubic-bezier(0.25,1,0.5,1) both;">
			{#if status === 'success'}
				<div class="text-center" style="animation: fadeUp 0.5s cubic-bezier(0.25,1,0.5,1) both;">
					<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
						<svg class="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					</div>
					<h1 class="font-heading text-2xl font-bold text-text-primary">{t('feedback.success')}</h1>
					<div class="mt-8 flex justify-center gap-3">
						<a href="/" class="rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover">{t('changelog.back')}</a>
						<button onclick={() => (status = 'idle')} class="btn btn-primary btn-md">
							{t('feedback.another')}
						</button>
					</div>
				</div>
			{:else}
				<div class="mb-8 text-center">
					<div class="badge badge-outline shadow-sm backdrop-blur-sm">
						<svg class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
						{t('feedback.link')}
					</div>
					<h1 class="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">{t('feedback.title')}</h1>
					<p class="mt-3 text-text-secondary">{t('feedback.subtitle')}</p>
				</div>

				<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
					<div>
						<label for="fb-name" class="mb-1.5 block text-sm font-medium text-text-secondary">{t('feedback.name')}</label>
						<input
							id="fb-name"
							type="text"
							bind:value={name}
							maxlength="100"
							placeholder={t('feedback.name.placeholder')}
							class="input input-lg"
						/>
					</div>

					<div>
						<label for="fb-message" class="mb-1.5 block text-sm font-medium text-text-secondary">{t('feedback.message')} <span class="text-red-400">*</span></label>
						<textarea
							id="fb-message"
							bind:value={message}
							required
							maxlength="2000"
							rows="5"
							placeholder={t('feedback.message.placeholder')}
							class="textarea input-lg"
						></textarea>
					</div>

					{#if status === 'error'}
						<div class="error-box">
							<svg class="h-4 w-4 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
							<span class="text-sm text-red-600 dark:text-red-400">{t('feedback.error')}</span>
						</div>
					{/if}

					<button
						type="submit"
						disabled={!message.trim() || status === 'sending'}
						class="btn btn-primary btn-md w-full"
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

				<div class="mt-6 text-center">
					<a href="/" class="text-sm text-text-muted transition-colors hover:text-text-secondary">{t('changelog.back')}</a>
				</div>
			{/if}
		</div>
	</main>
</div>
