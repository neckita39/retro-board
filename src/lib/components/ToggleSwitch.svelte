<script lang="ts">
	let { checked = $bindable(false), label = '', disabled = false }: { checked: boolean; label?: string; disabled?: boolean } = $props();
</script>

<label class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-surface-hover {disabled ? 'opacity-50 pointer-events-none' : ''}">
	<span class="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 {checked ? 'bg-accent' : 'bg-border-strong'}">
		<span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] {checked ? 'translate-x-4' : ''}"></span>
	</span>
	{#if label}
		<span class="text-sm text-text-secondary">{label}</span>
	{/if}
	<input type="checkbox" bind:checked {disabled} class="sr-only" />
</label>
