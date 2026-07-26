<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { t } from '$lib/i18n/index.js';

	// Пять минут на карточку. Отсчёт перезапускается сервером на каждом переходе,
	// поэтому здесь достаточно следить за focusEndTime.
	let remaining = $state<number | null>(null);
	let timer: ReturnType<typeof setInterval> | null = null;
	// Тап по чипу закрепляет подсказку — на тач-устройствах ховера нет
	let pinned = $state(false);

	function tick() {
		if (!socketStore.focusEndTime) {
			remaining = null;
			return;
		}
		remaining = Math.max(0, Math.ceil((socketStore.focusEndTime - Date.now()) / 1000));
	}

	$effect(() => {
		if (socketStore.focusEndTime) {
			tick();
			if (timer) clearInterval(timer);
			timer = setInterval(tick, 250);
		} else {
			remaining = null;
			if (timer) clearInterval(timer);
			timer = null;
		}
		return () => {
			if (timer) clearInterval(timer);
			timer = null;
		};
	});

	// Смена карточки снимает закреплённую подсказку
	$effect(() => {
		socketStore.focusCardId;
		pinned = false;
	});

	let total = $derived(socketStore.focusDuration ?? 0);
	let expired = $derived(remaining === 0);
	let progress = $derived(
		remaining !== null && total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 1
	);

	function formatTime(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
</script>

{#if remaining !== null}
	<div class="group relative shrink-0">
		<button
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				pinned = !pinned;
			}}
			onkeydown={(e) => {
				if (e.key === 'Escape' && pinned) {
					e.stopPropagation();
					pinned = false;
				}
			}}
			aria-describedby="focus-maxim"
			class="flex cursor-help items-center gap-2 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 shadow-[0_4px_14px_rgba(33,30,26,0.08)] transition-colors hover:bg-surface-hover"
		>
			<svg
				class="h-[13px] w-[13px] {expired ? 'text-bad' : 'text-text-secondary'}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			>
				<circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="M9 2h6" />
			</svg>
			<span
				class="text-[13px] font-bold tabular-nums {expired
					? 'timer-pulse text-bad'
					: 'text-text-primary'}"
			>
				{formatTime(remaining)}
			</span>
			<span class="hidden h-1 w-12 overflow-hidden rounded-full bg-border sm:block">
				<span
					class="block h-full rounded-full {expired || progress <= 0.2
						? 'bg-bad'
						: 'bg-accent'} transition-all duration-300 ease-linear"
					style="transform: scaleX({progress}); transform-origin: left;"
				></span>
			</span>
		</button>

		<!-- Максима про пятиминутный спор: ховер, клавиатурный фокус или тап -->
		<span
			id="focus-maxim"
			role="tooltip"
			class="pointer-events-none absolute right-0 top-full z-30 mt-2 w-60 rounded-xl bg-text-primary px-3 py-2 text-[12px] leading-snug text-surface shadow-[0_10px_28px_rgba(33,30,26,0.28)] transition-opacity duration-150
				{pinned
				? 'opacity-100'
				: 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}"
		>
			{t('focus.maxim')}
		</span>
	</div>
{/if}
