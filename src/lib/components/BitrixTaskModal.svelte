<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import ToggleSwitch from './ToggleSwitch.svelte';
	import { boardStore } from '$lib/stores/board.svelte.js';
	import { bitrixTaskStore } from '$lib/stores/bitrix-task.svelte.js';
	import { toastStore } from '$lib/stores/toast.svelte.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';
	import { buildTaskDraft } from '$lib/bitrix-draft.js';
	import { taskResultReaction, type TaskFormField } from '$lib/bitrix-task-result.js';
	import { txt } from '$lib/content/localized.js';
	import { t } from '$lib/i18n/index.js';

	// Преформа задачи Битрикс24: одна на доску, монтируется в Board.svelte (заметки макета 17–28).
	// Черновик считается один раз при открытии. Дальнейшие card:updated, голоса,
	// комментарии и переименование поля не трогают: что в поле, то и уходит.
	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])';

	type GroupStatus = { kind: 'idle' } | { kind: 'name'; name: string } | { kind: 'notFound' };
	type FormError = { text: string; settings: boolean; retry: boolean };

	let ready = $state(false);
	let cardId = $state('');
	let source = $state<'card' | 'summary'>('card');
	let title = $state('');
	let description = $state('');
	let groupId = $state('');
	let deadline = $state('');
	let important = $state(false);
	let hasImage = $state(false);
	let phone = $state(false);
	let today = $state('');
	let groupStatus = $state<GroupStatus>({ kind: 'idle' });
	let formError = $state<FormError | null>(null);
	let invalidField = $state<TaskFormField | null>(null);
	let groupShake = $state(false);
	let dialogEl = $state<HTMLDivElement | null>(null);

	let busy = $derived(bitrixTaskStore.submitting);

	// Не реактивные: объект current, для которого посчитан черновик, и кому вернуть фокус
	let openedWith: unknown = null;
	let opener: HTMLElement | null = null;
	let groupTimer: ReturnType<typeof setTimeout> | undefined;
	let groupAbort: AbortController | null = null;
	let shakeTimer: ReturnType<typeof setTimeout> | undefined;

	function localDate(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function startDraft(current: { cardId: string; source: 'card' | 'summary' }) {
		const board = boardStore.board;
		const info = boardStore.bitrix;
		if (!board || !info) {
			bitrixTaskStore.close();
			return;
		}
		const card = boardStore.cards.find((c) => c.id === current.cardId);
		// Карточки уже нет: модалку закроет эффект «карточка удалена» ниже
		if (!card) return;
		const comments = boardStore
			.getCardComments(card.id)
			.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
		const draft = buildTaskDraft({
			card,
			board: { title: board.title, slug: board.slug, format: board.format },
			columnTitle: txt(boardStore.columnDef(card.columnType).title),
			comments,
			likes: boardStore.getCardLikes(card.id),
			dislikes: boardStore.getCardDislikes(card.id),
			origin: window.location.origin,
			locale: localeStore.locale
		});
		openedWith = current;
		cardId = card.id;
		source = current.source;
		title = draft.title;
		description = draft.description;
		groupId = info.groupId !== null ? String(info.groupId) : '';
		// Название группы пространства уже известно: показываем без запроса
		groupStatus =
			info.groupId !== null && info.groupName ? { kind: 'name', name: info.groupName } : { kind: 'idle' };
		deadline = '';
		important = false;
		hasImage = !!card.imageId;
		formError = null;
		invalidField = null;
		groupShake = false;
		today = localDate();
		phone = window.matchMedia('(max-width: 639.98px)').matches;
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		ready = true;
	}

	function finish() {
		resetGroupCheck();
		clearTimeout(shakeTimer);
		openedWith = null;
		if (!ready) return;
		ready = false;
		const back = opener;
		opener = null;
		// Кнопка «В задачу» после создания исчезает, тогда фокус возвращать некуда
		if (back?.isConnected) back.focus();
	}

	// Открытие и закрытие модалки
	$effect(() => {
		const current = bitrixTaskStore.current;
		untrack(() => {
			if (!current) finish();
			else if (openedWith !== current) startDraft(current);
		});
	});

	// Карточку удалили, пока модалка открыта. Если запрос не идёт, закрываемся с тостом.
	// Если идёт, ждём ответа: сервер вернёт not_found
	$effect(() => {
		const current = bitrixTaskStore.current;
		if (!current || bitrixTaskStore.submitting) return;
		if (boardStore.cards.some((c) => c.id === current.cardId)) return;
		untrack(() => {
			bitrixTaskStore.close();
			toastStore.push({ kind: 'error', text: t('bitrix.toast.cardGone') });
		});
	});

	// Задачу по этой карточке создал другой ведущий (card:task): закрываемся молча
	$effect(() => {
		const current = bitrixTaskStore.current;
		if (!current || bitrixTaskStore.submitting) return;
		const card = boardStore.cards.find((c) => c.id === current.cardId);
		if (card?.bitrixTaskId) untrack(() => bitrixTaskStore.close());
	});

	onDestroy(() => {
		resetGroupCheck();
		clearTimeout(shakeTimer);
		// Ушли со страницы доски с открытой модалкой: current не должен дожить до следующей доски
		bitrixTaskStore.close();
	});

	function requestClose() {
		// Пока идёт отправка, закрыть нельзя ни крестиком, ни Escape, ни оверлеем
		if (bitrixTaskStore.submitting) return;
		bitrixTaskStore.close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (!ready || !bitrixTaskStore.current || !dialogEl) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			requestClose();
			return;
		}
		if (e.key !== 'Tab') return;
		// Фокус-ловушка: Tab с последнего элемента уходит на первый и обратно
		const items = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (items.length === 0) {
			e.preventDefault();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (!dialogEl.contains(active)) {
			e.preventDefault();
			(e.shiftKey ? last : first).focus();
		} else if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// Авторост описания: от 4 до 8 строк (min-h / max-h в классах), дальше прокрутка
	function autosize(node: HTMLTextAreaElement) {
		const fit = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight + 2}px`;
		};
		fit();
		const frame = requestAnimationFrame(fit);
		node.addEventListener('input', fit);
		return {
			destroy() {
				cancelAnimationFrame(frame);
				node.removeEventListener('input', fit);
			}
		};
	}

	function clearInvalid(field: TaskFormField) {
		if (invalidField === field) invalidField = null;
	}

	function resetGroupCheck() {
		clearTimeout(groupTimer);
		groupAbort?.abort();
		groupAbort = null;
	}

	// Проверка группы через 400 мс после ввода (заметка 21). Каждый ввод отменяет прошлый запрос
	function onGroupInput(raw: string) {
		resetGroupCheck();
		clearInvalid('groupId');
		const value = raw.trim();
		const info = boardStore.bitrix;
		if (!info || !/^[1-9]\d*$/.test(value)) {
			groupStatus = { kind: 'idle' };
			return;
		}
		if (Number(value) === info.groupId && info.groupName) {
			groupStatus = { kind: 'name', name: info.groupName };
			return;
		}
		groupStatus = { kind: 'idle' };
		groupTimer = setTimeout(() => void checkGroup(value), 400);
	}

	async function checkGroup(value: string) {
		const slug = boardStore.board?.slug;
		if (!slug) return;
		const controller = new AbortController();
		groupAbort = controller;
		try {
			const res = await fetch(`/${slug}/bitrix/group?id=${encodeURIComponent(value)}`, { signal: controller.signal });
			const body = (await res.json()) as { name?: unknown; notFound?: unknown };
			if (controller.signal.aborted || groupId.trim() !== value) return;
			// Ветвимся по телу, не по статусу. { unknown }, forbidden и лимит поле не подсвечивают
			if (typeof body.name === 'string') groupStatus = { kind: 'name', name: body.name };
			else if (body.notFound === true) groupStatus = { kind: 'notFound' };
		} catch {
			// отменили или сеть моргнула: поле не подсвечиваем
		} finally {
			if (groupAbort === controller) groupAbort = null;
		}
	}

	function shakeGroup() {
		groupShake = false;
		clearTimeout(shakeTimer);
		void tick().then(() => {
			groupShake = true;
			shakeTimer = setTimeout(() => (groupShake = false), 600);
		});
	}

	async function focusAfterError(field: TaskFormField | null) {
		await tick();
		if (!dialogEl) return;
		const target = field
			? dialogEl.querySelector<HTMLElement>(`[name="${field}"]`)
			: dialogEl.querySelector<HTMLElement>('[data-testid="bitrix-task-submit"]');
		target?.focus();
	}

	// Идиома AnalyzeButton: колбэк сам разбирает result и НЕ вызывает update().
	// invalidateAll перезапустил бы load доски и $effect входа в комнату
	// (повторный board:join, двойной users:count и board:state всем)
	const submitTask: SubmitFunction = ({ cancel }) => {
		const current = bitrixTaskStore.current;
		if (!current || bitrixTaskStore.submitting) {
			cancel();
			return;
		}
		const forCard = current.cardId;
		// FormData уже собрана до этого колбэка, поэтому disabled на полях её не обнулит
		bitrixTaskStore.submitting = true;
		formError = null;
		invalidField = null;
		return async ({ result }) => {
			bitrixTaskStore.submitting = false;
			const reaction = taskResultReaction(result);
			if (!reaction) return;
			switch (reaction.type) {
				case 'created':
					boardStore.setTask(forCard, reaction.task);
					bitrixTaskStore.close();
					toastStore.push({
						kind: 'success',
						text: t(reaction.toastKey, { id: reaction.task.id }),
						action: { label: t('bitrix.toast.open'), href: reaction.task.url, external: true }
					});
					return;
				case 'exists':
					if (reaction.task) boardStore.setTask(forCard, reaction.task);
					bitrixTaskStore.close();
					return;
				case 'closeWithToast':
					bitrixTaskStore.close();
					toastStore.push({ kind: 'error', text: t(reaction.toastKey) });
					return;
				case 'toast':
					toastStore.push({ kind: 'error', text: t(reaction.toastKey) });
					await focusAfterError(null);
					return;
				case 'form':
					formError = reaction.errorKey
						? { text: t(reaction.errorKey, reaction.params), settings: reaction.settings, retry: reaction.retry }
						: null;
					invalidField = reaction.field;
					if (reaction.groupNotFound) {
						groupStatus = { kind: 'notFound' };
						shakeGroup();
					}
					await focusAfterError(reaction.field);
			}
		};
	};
</script>

<svelte:window onkeydown={onKeydown} />

{#if ready && bitrixTaskStore.current && boardStore.bitrix && boardStore.board}
	{@const info = boardStore.bitrix}
	{@const slug = boardStore.board.slug}
	<!-- Оверлей: bg-scrim, клик мимо карточки закрывает (кроме отправки). На телефоне без scrim -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-overlay-enter fixed inset-0 z-[70] flex items-center justify-center bg-scrim p-4 max-sm:bg-transparent max-sm:p-0"
		onclick={(e) => {
			if (e.target === e.currentTarget) requestClose();
		}}
	>
		<!-- Телефон (заметка 28): лист во весь экран, вход fly y:24; шапка и кнопки прилипают, поля прокручиваются между ними -->
		<div
			bind:this={dialogEl}
			in:fly={{ y: phone ? 24 : 0, duration: phone ? 300 : 0, easing: cubicOut }}
			class="flex max-h-[calc(100dvh-2rem)] w-[480px] max-w-full flex-col rounded-3xl bg-surface-card shadow-2 max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:rounded-none max-sm:shadow-none {phone
				? ''
				: 'modal-card-enter'}"
			role="dialog"
			aria-modal="true"
			aria-labelledby="bitrix-task-heading"
		>
			<div class="flex shrink-0 items-start justify-between gap-3 px-6 pt-6 sm:px-8 sm:pt-8 max-sm:border-b max-sm:border-border max-sm:pb-4">
				<div class="flex min-w-0 flex-col gap-1.5">
					<h3 id="bitrix-task-heading" class="font-heading text-[21px] font-bold text-text-primary">{t('bitrix.form.title')}</h3>
					<p class="text-sm text-text-secondary">{t('bitrix.form.subtitle', { portal: info.portal })}</p>
				</div>
				<button
					type="button"
					onclick={requestClose}
					disabled={busy}
					class="btn-icon btn-icon-lg btn-icon-bordered shrink-0 {busy ? 'pointer-events-none opacity-50' : ''}"
					aria-label={t('bitrix.form.close')}
					title={t('bitrix.form.close')}
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
				</button>
			</div>

			<form
				method="POST"
				action="/{slug}?/createTask"
				use:enhance={submitTask}
				aria-busy={busy}
				data-testid="bitrix-task-form"
				class="flex min-h-0 flex-1 flex-col"
			>
				<input type="hidden" name="cardId" value={cardId} />
				<input type="hidden" name="source" value={source} />
				{#if important}
					<input type="hidden" name="important" value="on" />
				{/if}

				<div class="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-[18px] sm:px-8 {busy ? 'pointer-events-none opacity-50' : ''}">
					<label class="flex flex-col gap-2">
						<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.name')}</span>
						<input
							type="text"
							name="title"
							maxlength="250"
							autocomplete="off"
							bind:value={title}
							use:focusAndSelect
							oninput={() => clearInvalid('title')}
							disabled={busy}
							class="input input-lg bg-surface {invalidField === 'title' ? 'border-bad' : ''}"
						/>
					</label>

					<label class="flex flex-col gap-2">
						<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.description')}</span>
						<textarea
							name="description"
							maxlength="20000"
							rows="4"
							bind:value={description}
							use:autosize
							oninput={() => clearInvalid('description')}
							disabled={busy}
							class="textarea max-h-[204px] min-h-[114px] overflow-y-auto bg-surface px-[18px] py-3 text-[15px] leading-[1.5] {invalidField === 'description'
								? 'border-bad'
								: ''}"
						></textarea>
					</label>

					<div class="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
						<div class="flex min-w-0 flex-col">
							<label class="flex flex-col gap-2">
								<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.group')}</span>
								<input
									type="text"
									name="groupId"
									inputmode="numeric"
									autocomplete="off"
									bind:value={groupId}
									oninput={(e) => onGroupInput(e.currentTarget.value)}
									disabled={busy}
									class="input input-lg bg-surface {groupStatus.kind === 'notFound' || invalidField === 'groupId'
										? 'border-bad'
										: ''} {groupShake ? 'animate-[shake_0.5s_ease]' : ''}"
								/>
							</label>
							{#if groupStatus.kind === 'name'}
								<p class="mt-1.5 truncate text-[13px] text-text-muted">{groupStatus.name}</p>
							{:else if groupStatus.kind === 'notFound'}
								<p class="mt-1.5 text-[13px] text-bad">{t('bitrix.form.groupNotFound')}</p>
							{/if}
						</div>
						<label class="flex min-w-0 flex-col gap-2">
							<span class="text-sm font-semibold text-text-primary">{t('bitrix.form.deadline')}</span>
							<!-- Глиф календаря 16 muted (заметка 21) поверх нативного поля даты.
							     Chromium: свой индикатор пикера прозрачный (opacity-0) и лежит ровно над глифом,
							     клик по глифу открывает пикер (у глифа pointer-events-none).
							     Firefox рисует свою кнопку календаря и не даёт её стилизовать: там глиф прячется
							     и правый паддинг возвращается к 18px (@supports (-moz-appearance:none) — только Firefox).
							     Safari своего индикатора не рисует, глиф там декоративный.
							     span, а не div: внутри label допустим только фразовый контент -->
							<span class="relative block">
								<input
									type="date"
									name="deadline"
									min={today}
									bind:value={deadline}
									oninput={() => clearInvalid('deadline')}
									disabled={busy}
									class="input input-lg relative bg-surface pr-11 supports-[-moz-appearance:none]:pr-[18px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-3.5 [&::-webkit-calendar-picker-indicator]:my-auto [&::-webkit-calendar-picker-indicator]:size-6 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 {invalidField === 'deadline'
										? 'border-bad'
										: ''}"
								/>
								<svg
									class="pointer-events-none absolute right-[18px] top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted supports-[-moz-appearance:none]:hidden"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
							</span>
						</label>
					</div>

					<div class="self-start">
						<ToggleSwitch bind:checked={important} label={t('bitrix.form.important')} disabled={busy} />
					</div>

					<!-- Индикаторы, а не контролы: в Tab-порядок не входят -->
					<div class="flex flex-col gap-1.5 text-[13px] text-text-secondary">
						{#if hasImage}
							<p class="flex items-center gap-2">
								<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
								{t('bitrix.form.imageNote')}
							</p>
						{/if}
						<p class="flex items-center gap-2">
							<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
							{t('bitrix.form.responsible', { name: info.userName })}
						</p>
					</div>
				</div>

				<div class="flex shrink-0 flex-col gap-3 px-6 pb-6 sm:px-8 sm:pb-8 max-sm:border-t max-sm:border-border max-sm:pt-4 max-sm:pb-[max(env(safe-area-inset-bottom),1rem)]">
					{#if formError}
						<div role="alert" class="error-box flex-wrap" style="animation: fadeUp 0.25s cubic-bezier(0.25, 1, 0.5, 1) both;">
							<span>{formError.text}</span>
							{#if formError.settings}
								<a
									href="/spaces/{info.spaceSlug}?bitrix=1"
									onclick={() => bitrixTaskStore.close()}
									class="font-bold text-bad-strong underline"
								>
									{t('bitrix.form.settingsLink')}
								</a>
							{/if}
						</div>
					{/if}
					<div class="flex gap-2.5">
						<button type="button" onclick={requestClose} disabled={busy} class="btn btn-secondary btn-lg flex-1">
							{t('bitrix.form.cancel')}
						</button>
						<button
							type="submit"
							disabled={busy || !title.trim()}
							data-testid="bitrix-task-submit"
							class="btn btn-primary btn-lg min-w-0 flex-[2]"
						>
							{#if busy}
								<svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>
								<span class="min-w-0 truncate">{hasImage ? t('bitrix.form.creatingWithImage') : t('bitrix.form.creating')}</span>
							{:else if formError?.retry}
								{t('bitrix.form.retry')}
							{:else}
								{t('bitrix.form.submit')}
							{/if}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
