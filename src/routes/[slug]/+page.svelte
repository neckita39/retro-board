<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import AdminBanner from '$lib/components/AdminBanner.svelte';
	import Board from '$lib/components/Board.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import NamePrompt from '$lib/components/NamePrompt.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { data } = $props();

	$effect(() => {
		boardStore.setState(data);
		boardStore.isCreator = data.isCreator;
	});

	onMount(() => {
		socketStore.connect();
		socketStore.joinBoard(data.board.slug, data.creatorToken);
	});

	onDestroy(() => {
		socketStore.disconnect();
	});
</script>

<svelte:head>
	<title>{data.board.title} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header showOnline={true} adminLink={data.adminLink} spaceName={data.space?.name} spaceSlug={data.space?.slug} />
	{#if data.showAdminBanner && data.adminLink}
		<AdminBanner adminLink={data.adminLink} />
	{/if}
	<Onboarding />
	<NamePrompt />
	<Board />
	<footer class="sticky bottom-0 border-t border-border bg-surface px-4 py-2.5 transition-colors">
		<div class="mx-auto flex max-w-7xl items-center justify-center">
			<Timer creatorToken={data.creatorToken} />
		</div>
	</footer>
</div>
