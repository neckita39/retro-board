<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import Board from '$lib/components/Board.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { setKey } from '$lib/crypto.js';

	let { data } = $props();

	$effect(() => {
		boardStore.setState(data);
	});

	onMount(async () => {
		const hash = window.location.hash.slice(1);
		if (hash) {
			await setKey(hash);
		}

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
</div>
