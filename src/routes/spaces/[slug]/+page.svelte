<script lang="ts">
	import { onMount, onDestroy, untrack, tick } from 'svelte';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import SpacePasswordForm from '$lib/components/SpacePasswordForm.svelte';
	import BitrixPanel from '$lib/components/BitrixPanel.svelte';
	import SpaceBoardGrid from '$lib/components/SpaceBoardGrid.svelte';
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	import NewBoardModal from '$lib/components/NewBoardModal.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { t } from '$lib/i18n/index.js';
	import { normalizeTitle, TITLE_MAX } from '$lib/titles.js';
	import { ANALYSIS_FORMAT } from '$lib/formats.js';
	import { truncatedTitle } from '$lib/actions/truncated-title.js';
	import { panelSuccessKey } from '$lib/bitrix-panel.js';

	let { data, form } = $props();

	boardStore.board = null;

	// «Пространство создано» — тост с «Скопировать ссылку», один раз при первом
	// открытии по admin-ссылке. ?admin убираем из адреса сразу, чтобы в буфер
	// и в историю попала публичная ссылка.
	onMount(() => {
		if (!data.showCreatedToast || !data.adminLink) return;
		const clean = new URL(window.location.href);
		clean.searchParams.delete('admin');
		history.replaceState({}, '', clean.toString());
		toastStore.push({
			kind: 'success',
			text: t('space.admin.title'),
			action: { label: t('space.admin.copy'), onClick: () => navigator.clipboard.writeText(window.location.href) },
			timeoutMs: 15000
		});
	});

	// Комната пространства: статус AI-анализа для всех, кто здесь.
	// Без пароля (authenticated=false) сокет не нужен — и сервер в комнату не пустит.
	onMount(() => {
		if (!data.authenticated) return;
		socketStore.connect();
		socketStore.joinSpace(data.space.slug);
	});
	onDestroy(() => socketStore.disconnect());

	// untrack: seedAnalysis читает и пишет socketStore.analysis — без него
	// эффект подписался бы на собственную запись и зациклился
	$effect(() => {
		const state = data.analysis;
		untrack(() => socketStore.seedAnalysis(state));
	});

	// Готовая доска должна появиться в списке со счётчиками — перечитываем данные
	let refreshedFor = '';
	$effect(() => {
		const a = socketStore.analysis;
		if (a?.state === 'ready' && refreshedFor !== a.id) {
			refreshedFor = a.id;
			if (!data.boards.some((b) => b.slug === a.board.slug)) invalidateAll();
		}
	});

	// Reload boards on any navigation to this page (back button, link, etc.)
	afterNavigate(({ from }) => {
		if (from) invalidateAll();
	});

	// Handle browser bfcache restoration (back button after redirect)
	if (browser) {
		window.addEventListener('pageshow', (e) => {
			if (e.persisted) invalidateAll();
		});
	}

	let creating = $state(false);
	let deleteConfirming = $state(false);
	let passwordOpen = $state(false);
	let passwordShaking = $state(false);
	let passwordSuccess = $state('');
	let bitrixOpen = $state(false);
	let bitrixSuccessKey = $state<string | null>(null);
	let bitrixSuccessTimer: ReturnType<typeof setTimeout> | undefined;

	// Подключено и работает — на триггере галочка вместо глифа-ссылки (заметка 1 макета)
	let bitrixConnected = $derived(!!data.bitrix && !data.bitrix.lastError);

	// Открыта одна панель за раз: Битрикс24 сворачивает пароль и наоборот
	function openBitrix() {
		bitrixOpen = true;
		passwordOpen = false;
	}

	function toggleBitrix() {
		if (bitrixOpen) bitrixOpen = false;
		else openBitrix();
	}

	function togglePassword() {
		passwordOpen = !passwordOpen;
		if (passwordOpen) bitrixOpen = false;
	}

	let renaming = $state(false);
	let renameValue = $state('');
	let renameForm: HTMLFormElement | undefined = $state();
	let renameBusy = $state(false);

	function startRename() {
		renameValue = data.space.name;
		renaming = true;
		deleteConfirming = false;
	}

	// Пустое имя не отправляем: инпут остаётся, пока не поправят или не нажмут Esc
	function submitRename() {
		if (!renaming || renameBusy) return;
		if (!normalizeTitle(renameValue)) return;
		renameBusy = true;
		renameForm?.requestSubmit();
	}

	function onRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submitRename();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			renaming = false;
		}
	}

	// Blur после Esc прилетает на уже убранный инпут — renaming уже false, игнорируем
	function onRenameBlur() {
		if (!renaming) return;
		if (normalizeTitle(renameValue)) submitRename();
		else renaming = false;
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// createdAt is only present once the space password has been entered
	let spaceCreatedAt = $derived('createdAt' in data.space ? data.space.createdAt : null);

	// Доски-анализы — не ретро: их не считаем и не берём за образец названия
	let regularBoards = $derived(data.boards.filter((b) => b.format !== ANALYSIS_FORMAT));

	// Prefill the next sprint name: increment the trailing number of the latest board title
	let latestTitle = $derived(regularBoards[0]?.title ?? null);
	let suggestedTitle = $derived.by(() => {
		if (!latestTitle) return '';
		const match = latestTitle.match(/(\d+)(?=\D*$)/);
		if (!match) return '';
		const next = String(Number(match[1]) + 1);
		return latestTitle.slice(0, match.index) + next + latestTitle.slice(match.index! + match[1].length);
	});

	$effect(() => {
		if (form?.passwordAction) {
			if (form.passwordSuccess) {
				passwordOpen = false;
				passwordSuccess = form.passwordAction === 'disable' ? 'disabled' : 'enabled';
				setTimeout(() => (passwordSuccess = ''), 2500);
			} else if (form.passwordError === 'wrong_password') {
				passwordShaking = true;
				setTimeout(() => (passwordShaking = false), 600);
			}
		}
	});

	// Ответ экшенов Битрикс24, как у пароля: успех — бейдж у заголовка на 2,5 с;
	// ошибка — панель должна быть видна (её могли свернуть, пока шёл запрос).
	// Текст ошибки, рамку и shake рисует сама панель
	$effect(() => {
		if (!form?.bitrixAction) return;
		if (form.bitrixSuccess) {
			clearTimeout(bitrixSuccessTimer);
			bitrixSuccessKey = panelSuccessKey(form.bitrixAction);
			bitrixSuccessTimer = setTimeout(() => (bitrixSuccessKey = null), 2500);
		} else if (form.bitrixError) {
			openBitrix();
		}
	});

	// Пункт «Подключить Битрикс24» в меню доски ведёт сюда с ?bitrix=1: панель
	// раскрыта, фокус в поле вебхука. tick — дождаться снятия inert;
	// preventScroll — поле внутри раскрывающегося collapsible с overflow:hidden
	onMount(async () => {
		if (!data.isCreator || page.url.searchParams.get('bitrix') !== '1') return;
		openBitrix();
		await tick();
		document.getElementById('bitrix-webhook')?.focus({ preventScroll: true });
	});

	async function deleteSpace() {
		deleteConfirming = false;
		const res = await fetch(`/spaces/${data.space.slug}`, { method: 'DELETE' });
		if (res.ok) window.location.href = '/';
	}

	function sinceDate(iso: string): string {
		const d = new Date(iso);
		if (localeStore.locale === 'ru') {
			// Full date puts the month in genitive («4 июля 2026 г.») — strip the day and the «г.»
			return d
				.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
				.replace(/^\d+\s/, '')
				.replace(/\s?г\.$/, '');
		}
		return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{data.space.name} — {t('header.brand')}</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header
		onNewBoard={data.authenticated ? () => (creating = true) : null}
		analysis={data.authenticated && data.analysisEnabled ? { spaceSlug: data.space.slug } : null}
	/>

	{#if !data.authenticated}
		<SpacePasswordForm spaceName={data.space.name} error={form?.error === 'wrong_password' ? t('space.password.error') : ''} />
	{:else}
		<main class="flex-1 px-4 pb-16 sm:px-7">
			<div class="mx-auto flex max-w-[1360px] flex-col gap-7 pt-9 sm:pt-10">
				<!-- Заголовок и панель пароля — один блок: свёрнутая панель не должна
				     занимать место и добавлять зазор сетки перед списком досок -->
				<div class="flex flex-col">
				<!-- Space heading: название живёт только здесь (в шапке — один бренд) -->
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div class="flex min-w-0 flex-col gap-2">
						<div class="flex items-center gap-3">
							{#if renaming}
								<form
									method="POST"
									action="?/rename"
									bind:this={renameForm}
									class="min-w-0 flex-1"
									use:enhance={() => {
										return async ({ result, update }) => {
											renameBusy = false;
											if (result.type === 'success') renaming = false;
											await update();
										};
									}}
								>
									<input
										type="text"
										name="name"
										bind:value={renameValue}
										use:focusAndSelect
										onkeydown={onRenameKey}
										onblur={onRenameBlur}
										maxlength={TITLE_MAX}
										aria-label={t('space.rename.label')}
										class="input font-heading h-auto w-full px-3 py-1 text-[26px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[32px]"
									/>
								</form>
							{:else}
								<h1 class="font-heading min-w-0 truncate text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-text-primary sm:text-[32px]" use:truncatedTitle={data.space.name}>{data.space.name}</h1>
							{/if}
							{#if data.hasPassword}
								<span class="badge badge-outline shrink-0">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
									{t('space.locked')}
								</span>
							{/if}
							{#if data.isCreator && !renaming}
								<!-- Тот же карандаш, что у названия доски: 28px без рамки -->
								<button
									onclick={startRename}
									class="btn-icon btn-icon-sm shrink-0"
									title={t('space.rename')}
									aria-label={t('space.rename')}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
								</button>
							{/if}
							{#if passwordSuccess}
								<span class="badge badge-success badge-pop shrink-0">
									{t(passwordSuccess === 'enabled' ? 'space.password.enabled' : 'space.password.disabled')}
								</span>
							{/if}
							{#if bitrixSuccessKey}
								<span class="badge badge-success badge-pop shrink-0">{t(bitrixSuccessKey)}</span>
							{/if}
						</div>
						{#if spaceCreatedAt}
							<p class="text-[15px] text-text-secondary">
								{t('space.meta.count', { n: regularBoards.length })} · {t('space.meta.since', { date: sinceDate(spaceCreatedAt) })}
							</p>
						{/if}
					</div>
					{#if data.isCreator}
						<div class="flex flex-wrap items-center gap-3">
							{#if deleteConfirming}
								<span class="text-[13px] text-text-secondary">{t('space.delete.confirm')}</span>
								<button onclick={deleteSpace} class="btn btn-danger btn-md">
									{t('space.delete')}
								</button>
								<button onclick={() => (deleteConfirming = false)} class="btn btn-secondary btn-md">
									{t('card.cancel')}
								</button>
							{:else}
								<!-- Битрикс24 — кнопка, а не тумблер: у подключения нет «вкл/выкл» без данных.
								     Ряд 38px: [Битрикс24 ⌄] [Пароль ◯] [🗑] -->
								<button
									type="button"
									onclick={toggleBitrix}
									class="btn btn-secondary btn-md pr-3.5"
									aria-expanded={bitrixOpen}
									aria-controls="bitrix-panel"
									data-testid="bitrix-panel-toggle"
								>
									{#if bitrixConnected}
										<svg class="h-4 w-4 shrink-0 text-well" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
									{:else}
										<svg class="h-4 w-4 shrink-0 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
									{/if}
									{t('bitrix.panel.toggle')}
									<svg class="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-200 {bitrixOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
								</button>
								<!-- Переключатель показывает то состояние, которое панель ниже собирается
								     подтвердить: открыли панель — тумблер уже «после» смены -->
								<ToggleSwitch
									checked={passwordOpen ? !data.hasPassword : data.hasPassword}
									label={t('space.password.toggle')}
									onchange={togglePassword}
								/>
								<!-- Delete button -->
								<button
									onclick={() => { deleteConfirming = true; passwordOpen = false; bitrixOpen = false; }}
									class="btn-icon btn-icon-lg btn-icon-bordered hover:bg-bad-bg hover:text-bad"
									title={t('space.delete')}
									aria-label={t('space.delete')}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
										<path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
									</svg>
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Password management panel -->
				{#if data.isCreator}
					<div class="collapsible {passwordOpen ? 'open' : ''}">
					<!-- Рамка и отступ на внуке: у ребёнка с overflow:hidden они бы остались видны и при 0fr -->
					<div>
					<div class="mt-7 rounded-2xl border border-border bg-surface-card p-4">
						{#if data.hasPassword}
							<form method="POST" action="?/disablePassword" use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'failure') {
										passwordShaking = true;
										setTimeout(() => (passwordShaking = false), 600);
									}
									await update();
								};
							}}>
								<p class="mb-2 text-sm text-text-secondary">{t('space.password.disable.desc')}</p>
								<div class="flex gap-2">
									<input
										type="password"
										name="password"
										required
										maxlength="100"
										placeholder={t('space.password.placeholder')}
										class="input input-md flex-1 {form?.passwordAction === 'disable' && form?.passwordError === 'wrong_password' ? 'border-bad' : ''} {passwordShaking ? 'animate-[shake_0.5s_ease]' : ''}"
									/>
									<button type="submit" class="btn btn-danger btn-md">
										{t('space.password.disable')}
									</button>
									<button type="button" onclick={() => (passwordOpen = false)} class="btn btn-secondary btn-md">
										{t('card.cancel')}
									</button>
								</div>
								{#if form?.passwordAction === 'disable' && form?.passwordError === 'wrong_password'}
									<p class="mt-1.5 text-[13px] text-bad">{t('space.password.error')}</p>
								{/if}
							</form>
						{:else}
							<form method="POST" action="?/enablePassword" use:enhance>
								<p class="mb-2 text-sm text-text-secondary">{t('space.password.enable')}</p>
								<div class="flex gap-2">
									<input
										type="password"
										name="password"
										required
										maxlength="100"
										placeholder={t('space.password.enable.placeholder')}
										class="input input-md flex-1"
									/>
									<button type="submit" class="btn btn-primary btn-md">
										{t('space.password.enable')}
									</button>
									<button type="button" onclick={() => (passwordOpen = false)} class="btn btn-secondary btn-md">
										{t('card.cancel')}
									</button>
								</div>
							</form>
						{/if}
					</div>
					</div>
					</div>
					<BitrixPanel
						bitrix={data.bitrix ?? null}
						encryptionEnabled={data.encryptionEnabled ?? false}
						{form}
						open={bitrixOpen}
						onclose={() => (bitrixOpen = false)}
					/>
				{/if}
				</div>

				<SpaceBoardGrid
					boards={data.boards}
					analysis={socketStore.analysis ?? data.analysis}
					spaceSlug={data.space.slug}
					animate={data.animateTiles}
					onNewBoard={() => (creating = true)}
				/>
			</div>
		</main>
	{/if}

	{#if creating}
		<NewBoardModal
			spaceSlug={data.space.slug}
			spaceName={data.space.name}
			{suggestedTitle}
			suggestedFrom={suggestedTitle ? latestTitle : null}
			defaultFormat={'lastFormat' in data.space ? (data.space.lastFormat ?? null) : null}
			onClose={() => (creating = false)}
		/>
	{/if}
</div>
