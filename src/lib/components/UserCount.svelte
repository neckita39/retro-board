<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
</script>

<div class="flex items-center gap-1.5 text-sm text-text-secondary">
	<span class="relative flex h-2 w-2">
		{#if socketStore.connected}
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
			<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
		{:else}
			<span class="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
		{/if}
	</span>
	<span>{socketStore.usersCount} online</span>
</div>
