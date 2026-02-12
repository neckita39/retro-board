<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import Board from '$lib/components/Board.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';

	let { data } = $props();

	$effect(() => {
		boardStore.setState(data);
	});

	onMount(() => {
		socketStore.connect();
		socketStore.joinBoard(data.board.slug);
	});

	onDestroy(() => {
		socketStore.disconnect();
	});
</script>

<svelte:head>
	<title>{data.board.title} — Retro Board</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header showOnline={true} />
	<Board />
	<footer class="sticky bottom-0 border-t border-border bg-surface-card px-4 py-3 transition-colors sm:px-6">
		<div class="mx-auto flex max-w-7xl items-center justify-center">
			<Timer />
		</div>
	</footer>
</div>
