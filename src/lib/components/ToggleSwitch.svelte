<script lang="ts">
	// Переключатель с подписью в рамке 38px — тот же рост, что у кнопок шапки
	// и тулбаров. bind:checked — для формы создания; onchange — для страницы
	// пространства, где видимое состояние вычисляется родителем.
	// Кнопка-бегунок — bg-white намеренно (единственное разрешённое «сырое» белое,
	// см. DESIGN-SYSTEM.md, правило «Цвет»): дорожка насыщенная в обеих темах
	// (accent / border-strong), а surface-card в тёмной теме сливается с ней.
	let {
		checked = $bindable(false),
		label = '',
		disabled = false,
		onchange = null
	}: {
		checked: boolean;
		label?: string;
		disabled?: boolean;
		onchange?: ((checked: boolean) => void) | null;
	} = $props();
</script>

<label class="inline-flex h-[38px] cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface-card pl-3 pr-3.5 transition-colors hover:bg-surface-hover {disabled ? 'opacity-50 pointer-events-none' : ''}">
	<span class="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 {checked ? 'bg-accent' : 'bg-border-strong'}">
		<span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] {checked ? 'translate-x-4' : ''}"></span>
	</span>
	{#if label}
		<span class="text-sm font-semibold text-text-primary">{label}</span>
	{/if}
	<!-- Значение берём из самого инпута: bind уже обновил checked, но так надёжнее при любом порядке обработчиков -->
	<input type="checkbox" bind:checked {disabled} onchange={(e) => onchange?.(e.currentTarget.checked)} class="sr-only" />
</label>
