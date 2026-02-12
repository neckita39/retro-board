<script lang="ts">
	import '../app.css';
	import { themeStore } from '$lib/stores/theme.svelte.js';
	import { browser } from '$app/environment';

	let { children } = $props();

	$effect(() => {
		if (browser) {
			themeStore.apply();
		}
	});
</script>

{@render children()}
