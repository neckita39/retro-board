<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';

	let inputMinutes = $state(5);
	let remaining = $state<number | null>(null);
	let interval = $state<ReturnType<typeof setInterval> | null>(null);
	let expired = $state(false);

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
			if (interval) clearInterval(interval);
			interval = null;
		}
	}

	$effect(() => {
		if (socketStore.timerEnd) {
			expired = false;
			tick();
			if (interval) clearInterval(interval);
			interval = setInterval(tick, 250);
		} else {
			remaining = null;
			expired = false;
			if (interval) clearInterval(interval);
			interval = null;
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	});

	function start() {
		if (inputMinutes <= 0) return;
		socketStore.startTimer(inputMinutes * 60);
	}

	function stop() {
		socketStore.stopTimer();
	}

	function formatTime(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
</script>

{#if remaining !== null}
	<div
		class="flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors {expired
			? 'animate-pulse border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400'
			: 'border-border bg-surface-card text-text-primary'}"
	>
		<span class="tabular-nums">{formatTime(remaining)}</span>
		<button
			onclick={stop}
			class="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-text-primary"
			aria-label="Stop timer"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
	</div>
{:else}
	<div class="flex items-center gap-1">
		<input
			type="number"
			min="1"
			max="99"
			bind:value={inputMinutes}
			class="h-9 w-12 rounded-lg border border-border bg-surface-card px-1.5 text-center text-sm text-text-primary outline-none transition-colors focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			aria-label="Minutes"
		/>
		<button
			onclick={start}
			class="flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
			aria-label="Start timer"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="5 3 19 12 5 21 5 3"/>
			</svg>
			<span>min</span>
		</button>
	</div>
{/if}
