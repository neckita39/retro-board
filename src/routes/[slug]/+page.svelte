<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import Board from '$lib/components/Board.svelte';
	import NamePrompt from '$lib/components/NamePrompt.svelte';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { data } = $props();

	$effect(() => {
		boardStore.setState(data);
		boardStore.isCreator = data.isCreator;
		boardStore.setBitrix(data.bitrix, data.bitrixOffer);
	});

	// Уведомления об AI-анализе пространства приходят и сюда
	// untrack: seedAnalysis читает и пишет socketStore.analysis — без него
	// эффект подписался бы на собственную запись и зациклился
	$effect(() => {
		const state = data.analysis;
		untrack(() => socketStore.seedAnalysis(state));
	});

	// Вход в комнаты — эффект, а не onMount: переход с доски на доску (кнопка
	// «Открыть» в уведомлении) не перемонтирует страницу, а сокет должен
	// переехать в новую комнату. В комнату пространства идём только с доступом
	// к нему (analysis === null — пароль не введён).
	$effect(() => {
		const slug = data.board.slug;
		const token = data.creatorToken;
		const spaceSlug = data.analysis !== null ? (data.space?.slug ?? null) : null;
		untrack(() => {
			socketStore.connect();
			socketStore.joinBoard(slug, token);
			if (spaceSlug) socketStore.joinSpace(spaceSlug);
		});
	});

	// «Доска создана» — тост с «Скопировать ссылку», один раз при первом открытии
	// по admin-ссылке. ?admin убираем из адреса сразу, чтобы в буфер и в историю
	// попала публичная ссылка.
	onMount(() => {
		if (!data.showCreatedToast || !data.adminLink) return;
		const clean = new URL(window.location.href);
		clean.searchParams.delete('admin');
		history.replaceState({}, '', clean.toString());
		toastStore.push({
			kind: 'success',
			text: t('admin.banner.title'),
			action: { label: t('admin.banner.copy'), onClick: () => navigator.clipboard.writeText(window.location.href) },
			timeoutMs: 15000
		});
	});

	onDestroy(() => {
		socketStore.disconnect();
	});
</script>

<svelte:head>
	<title>{boardStore.board?.title ?? data.board.title} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header
		showOnline={true}
		adminLink={data.adminLink}
		spaceName={data.space?.name}
		spaceSlug={data.space?.slug}
		creatorToken={data.creatorToken}
		analysis={data.space && data.analysisEnabled ? { spaceSlug: data.space.slug } : null}
	/>
	<NamePrompt />
	<Board creatorToken={data.creatorToken} />
</div>
