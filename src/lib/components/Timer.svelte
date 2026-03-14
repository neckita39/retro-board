<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { creatorToken = null }: { creatorToken?: string | null } = $props();

	let selectedMinutes = $state(5);
	let remaining = $state<number | null>(null);
	let totalSeconds = $state(0);
	let expired = $state(false);
	let timer: ReturnType<typeof setInterval> | null = null;

	function tick() {
		if (!socketStore.timerEnd) {
			remaining = null;
			expired = false;
			return;
		}
		const left = Math.max(0, Math.ceil((socketStore.timerEnd - Date.now()) / 1000));
		remaining = left;
		if (left === 0) {
			expired = true;
			if (timer) clearInterval(timer);
			timer = null;
		}
	}

	$effect(() => {
		if (socketStore.timerEnd) {
			expired = false;
			tick();
			if (timer) clearInterval(timer);
			timer = setInterval(tick, 250);
		} else {
			remaining = null;
			expired = false;
			if (timer) clearInterval(timer);
			timer = null;
		}
		return () => {
			if (timer) clearInterval(timer);
			timer = null;
		};
	});

	function start() {
		selectedMinutes = Math.max(1, Math.min(60, Math.round(selectedMinutes)));
		totalSeconds = selectedMinutes * 60;
		socketStore.startTimer(totalSeconds, creatorToken);
	}

	function stop() {
		socketStore.stopTimer(creatorToken);
	}

	function stepMinutes(delta: number) {
		selectedMinutes = Math.max(1, Math.min(60, selectedMinutes + delta));
	}

	function clampMinutes() {
		if (isNaN(selectedMinutes) || selectedMinutes < 1) selectedMinutes = 1;
		if (selectedMinutes > 60) selectedMinutes = 60;
		selectedMinutes = Math.round(selectedMinutes);
	}

	function formatTime(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	// Progress bar width (0 to 1)
	let progress = $derived(
		remaining !== null && totalSeconds > 0
			? Math.max(0, Math.min(1, remaining / totalSeconds))
			: 1
	);

	// Color based on progress
	let barColor = $derived(
		expired
			? 'bg-red-500'
			: progress > 0.5
				? 'bg-emerald-500'
				: progress > 0.2
					? 'bg-yellow-500'
					: 'bg-red-500'
	);

	let timeColor = $derived(
		expired
			? 'text-red-500'
			: progress <= 0.2
				? 'text-yellow-500'
				: 'text-text-primary'
	);
</script>

{#if remaining !== null}
	<!-- Running / Expired — Minimal Bar -->
	<div class="flex items-center gap-2.5 rounded-xl border border-border bg-surface-card px-4 py-2">
		<span class="text-lg font-bold tabular-nums tracking-tight {expired ? 'text-red-500' : timeColor}">
			{formatTime(expired ? 0 : remaining)}
		</span>
		<div class="h-[3px] w-20 overflow-hidden rounded-full bg-border">
			<div
				class="{barColor} h-full rounded-full transition-all duration-300 ease-linear"
				style="transform: scaleX({progress}); transform-origin: left;"
			></div>
		</div>
		{#if boardStore.isCreator}
			<button
				onclick={stop}
				class="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
				aria-label={t('timer.stop')}
				title={t('timer.stop')}
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		{/if}
	</div>
{:else if boardStore.isCreator}
	<!-- Idle — Stepper with solid play -->
	<div class="flex items-center overflow-hidden rounded-xl border border-border bg-surface-card">
		<button
			onclick={() => stepMinutes(-1)}
			class="flex h-9 w-8 items-center justify-center text-base text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary active:scale-90"
		>
			−
		</button>
		<input
			type="number"
			min="1"
			max="60"
			bind:value={selectedMinutes}
			onclick={(e) => (e.target as HTMLInputElement).select()}
			onblur={clampMinutes}
			onkeydown={(e) => { if (e.key === 'Enter') { clampMinutes(); start(); } }}
			class="h-9 w-11 border-x border-border bg-transparent text-center text-sm font-bold tabular-nums text-text-primary focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
		/>
		<button
			onclick={() => stepMinutes(1)}
			class="flex h-9 w-8 items-center justify-center text-base text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary active:scale-90"
		>
			+
		</button>
		<button
			onclick={start}
			class="flex h-9 w-9 items-center justify-center rounded-r-xl bg-accent text-white transition-colors hover:bg-accent-hover active:scale-95"
			aria-label={t('timer.start')}
			title={t('timer.start')}
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<polygon points="5 3 19 12 5 21 5 3" />
			</svg>
		</button>
	</div>
{/if}
