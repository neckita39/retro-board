<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { t } from '$lib/i18n/index.js';

	const PRESETS = [3, 5, 10];
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
		if (selectedMinutes <= 0) return;
		totalSeconds = selectedMinutes * 60;
		socketStore.startTimer(totalSeconds);
	}

	function stop() {
		socketStore.stopTimer();
	}

	function formatTime(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	// SVG circle constants
	const SIZE = 80;
	const STROKE = 5;
	const RADIUS = (SIZE - STROKE) / 2;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	let progress = $derived(
		remaining !== null && totalSeconds > 0
			? Math.max(0, Math.min(1, remaining / totalSeconds))
			: 1
	);

	let strokeOffset = $derived(CIRCUMFERENCE * (1 - progress));

	let ringColor = $derived(
		expired
			? 'stroke-red-500'
			: progress > 0.5
				? 'stroke-emerald-500'
				: progress > 0.2
					? 'stroke-yellow-500'
					: 'stroke-red-500'
	);
</script>

{#if remaining !== null}
	<!-- Running / Expired state -->
	<div class="flex flex-col items-center gap-2">
		<div class="relative {expired ? 'animate-pulse' : ''}">
			<svg width={SIZE} height={SIZE} class="-rotate-90">
				<!-- Background ring -->
				<circle
					cx={SIZE / 2}
					cy={SIZE / 2}
					r={RADIUS}
					fill="none"
					stroke-width={STROKE}
					class="stroke-border"
				/>
				<!-- Progress ring -->
				<circle
					cx={SIZE / 2}
					cy={SIZE / 2}
					r={RADIUS}
					fill="none"
					stroke-width={STROKE}
					stroke-linecap="round"
					stroke-dasharray={CIRCUMFERENCE}
					stroke-dashoffset={strokeOffset}
					class="{ringColor} transition-[stroke-dashoffset] duration-300 ease-linear"
				/>
			</svg>
			<!-- Time display centered in ring -->
			<div class="absolute inset-0 flex items-center justify-center">
				{#if expired}
					<span class="text-xs font-bold text-red-500">{t('timer.expired')}</span>
				{:else}
					<span class="text-sm font-semibold tabular-nums text-text-primary">{formatTime(remaining)}</span>
				{/if}
			</div>
		</div>
		<button
			onclick={stop}
			class="flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
			aria-label={t('timer.stop')}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
			{t('timer.stop')}
		</button>
	</div>
{:else}
	<!-- Idle state: presets + start -->
	<div class="flex items-center gap-2">
		<div class="flex rounded-lg border border-border">
			{#each PRESETS as mins}
				<button
					onclick={() => (selectedMinutes = mins)}
					class="px-2.5 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg {selectedMinutes === mins
						? 'bg-text-primary text-surface'
						: 'text-text-secondary hover:bg-surface-hover'}"
				>
					{mins}
				</button>
			{/each}
		</div>
		<button
			onclick={start}
			class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
			aria-label={t('timer.start')}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="5 3 19 12 5 21 5 3"/>
			</svg>
			{t('timer.start')}
		</button>
	</div>
{/if}
