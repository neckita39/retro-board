<script lang="ts">
	import '../app.css';
	import { themeStore } from '$lib/stores/theme.svelte.js';
	import { browser } from '$app/environment';
	import { onNavigate } from '$app/navigation';
	import Lightbox from '$lib/components/Lightbox.svelte';

	let { children } = $props();

	$effect(() => {
		if (browser) {
			themeStore.apply();
		}
	});

	// Smooth crossfade between pages via View Transitions API
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<style>
		@keyframes fadeIn {
			from { opacity: 0; }
			to { opacity: 1; }
		}
		@keyframes fadeOut {
			from { opacity: 1; }
			to { opacity: 0; }
		}
		::view-transition-old(root) {
			animation: fadeOut 0.2s cubic-bezier(0.25, 1, 0.5, 1);
		}
		::view-transition-new(root) {
			animation: fadeIn 0.3s cubic-bezier(0.25, 1, 0.5, 1);
		}
	</style>
</svelte:head>

{@render children()}

<Lightbox />
