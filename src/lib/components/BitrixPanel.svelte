<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { t } from '$lib/i18n/index.js';
	import { panelErrorKey } from '$lib/bitrix-panel.js';

	// Панель Битрикс24 на странице пространства, только для создателя (заметки
	// макета 1–9, спека Секция 4). Состояния: не подключено / проверка / подключено /
	// ошибка / вебхук перестал работать (lastError) / шифрование не настроено.
	// Данные — только из data.bitrix: после успешного экшена use:enhance делает
	// invalidateAll, и load перечитывает space_bitrix. Бейдж «Подключено /
	// Отключено / Сохранено» у заголовка страницы рисует сама страница, как у пароля.
	interface PanelInfo {
		portal: string;
		userName: string;
		groupId: number | null;
		groupName: string | null;
		lastError: string | null;
	}
	// Поля ответа экшенов bitrixConnect / bitrixDisconnect / bitrixSetGroup.
	// У остальных экшенов страницы (rename, пароль, анализ) их нет
	interface PanelForm {
		bitrixAction?: string;
		bitrixSuccess?: boolean;
		bitrixError?: string;
		field?: string;
		groupNameUnavailable?: boolean;
	}
	type Field = 'webhook' | 'groupId';

	let {
		bitrix,
		encryptionEnabled,
		form,
		open,
		onclose
	}: {
		bitrix: PanelInfo | null;
		encryptionEnabled: boolean;
		form: PanelForm | null | undefined;
		open: boolean;
		onclose: () => void;
	} = $props();

	let connecting = $state(false);
	let error = $state<{ kind: string; field: Field | null } | null>(null);
	let shaking = $state<Field | null>(null);
	let groupNameUnavailable = $state(false);

	let editingGroup = $state(false);
	let groupValue = $state('');
	let savingGroup = $state(false);
	// Значение, на котором setGroup уже упал: blur с ним не шлёт запрос повторно
	let failedGroupValue: string | null = null;

	let confirmDisconnect = $state(false);
	let disconnecting = $state(false);

	let webhookInput: HTMLInputElement | undefined = $state();
	let connectGroupInput: HTMLInputElement | undefined = $state();
	let editGroupInput: HTMLInputElement | undefined = $state();
	let groupForm: HTMLFormElement | undefined = $state();
	let disconnectForm: HTMLFormElement | undefined = $state();

	let shakeTimer: ReturnType<typeof setTimeout> | undefined;
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => {
		clearTimeout(shakeTimer);
		clearTimeout(confirmTimer);
	});

	let errorText = $derived(error ? t(panelErrorKey(error.kind)) : '');
	let initial = $derived(bitrix ? bitrix.userName.trim().charAt(0).toUpperCase() : '');
	let savedGroup = $derived(bitrix && bitrix.groupId !== null ? String(bitrix.groupId) : '');

	// Группа — только цифры: буквы не долетают до сервера и не тратят лимит
	function digitsOnly(input: HTMLInputElement): string {
		const digits = input.value.replace(/\D/g, '');
		if (digits !== input.value) input.value = digits;
		return digits;
	}

	// Ошибка: текст 13 text-bad под рядом, рамка border-bad и shake на 600 мс,
	// фокус возвращается в поле, введённое не стираем (заметка 9)
	function showError(kind: string, field: Field | null) {
		error = { kind, field };
		if (!field) return;
		clearTimeout(shakeTimer);
		shaking = field;
		shakeTimer = setTimeout(() => (shaking = null), 600);
		// preventScroll: панель могла только что раскрыться, а фокус внутри
		// overflow:hidden прокрутил бы её содержимое
		tick().then(() => {
			const input = field === 'webhook' ? webhookInput : editingGroup ? editGroupInput : connectGroupInput;
			input?.focus({ preventScroll: true });
		});
	}

	// Ответ экшена. untrack: showError читает editingGroup и инпуты — эффект
	// должен зависеть только от form
	$effect(() => {
		const f = form;
		if (!f?.bitrixAction) return;
		const action = f.bitrixAction;
		const kind = f.bitrixError;
		const field = f.field;
		const success = f.bitrixSuccess === true;
		const unavailable = f.groupNameUnavailable === true;
		untrack(() => {
			if (success) {
				error = null;
				editingGroup = false;
				groupNameUnavailable = unavailable;
			} else if (kind) {
				const target: Field | null =
					action === 'setGroup' || field === 'groupId' ? 'groupId' : action === 'connect' ? 'webhook' : null;
				showError(kind, target);
			}
		});
	});

	// Свернули панель — сбрасываем локальное: ошибку, правку группы, подтверждение
	$effect(() => {
		if (open) return;
		untrack(() => {
			error = null;
			shaking = null;
			groupNameUnavailable = false;
			editingGroup = false;
			confirmDisconnect = false;
			clearTimeout(confirmTimer);
		});
	});

	const submitConnect: SubmitFunction = ({ formData, cancel }) => {
		if (connecting) return cancel();
		// Пустое поле не отправляем: попытка съела бы лимит подключений впустую
		if (!String(formData.get('webhook') ?? '').trim()) {
			cancel();
			showError('invalid_url', 'webhook');
			return;
		}
		connecting = true;
		error = null;
		groupNameUnavailable = false;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				connecting = false;
			}
		};
	};

	function startGroupEdit() {
		groupValue = savedGroup;
		failedGroupValue = null;
		error = null;
		confirmDisconnect = false;
		editingGroup = true;
	}

	function cancelGroupEdit() {
		editingGroup = false;
		error = null;
	}

	// Не изменили — просто закрываем, запрос к порталу не нужен
	function submitGroup() {
		if (!editingGroup || savingGroup) return;
		if (groupValue === savedGroup) {
			cancelGroupEdit();
			return;
		}
		groupForm?.requestSubmit();
	}

	function onGroupKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			submitGroup();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelGroupEdit();
		}
	}

	// Blur сохраняет, как у переименования. Исключения: после Esc инпута уже нет;
	// фокус ушёл на «Сохранить»/«Отмена» этой же формы; значение уже отклонено порталом
	function onGroupBlur(e: FocusEvent) {
		if (!editingGroup || savingGroup) return;
		if (e.relatedTarget instanceof Node && groupForm?.contains(e.relatedTarget)) return;
		if (groupValue === failedGroupValue) {
			cancelGroupEdit();
			return;
		}
		submitGroup();
	}

	const submitGroupForm: SubmitFunction = ({ cancel }) => {
		if (savingGroup) return cancel();
		savingGroup = true;
		error = null;
		const sent = groupValue;
		return async ({ result, update }) => {
			try {
				if (result.type === 'success') editingGroup = false;
				else failedGroupValue = sent;
				await update();
				// Отказ сам load не перечитывает, а setGroup мог записать lastError
				// (вебхук отозван) — панель сразу покажет форму переподключения
				if (result.type === 'failure') await invalidateAll();
			} finally {
				savingGroup = false;
			}
		};
	};

	// Первый клик — красная «Нажмите ещё раз — отключить» на 3 с, второй — отключаем.
	// Без браузерных диалогов (заметка 8)
	function onDisconnectClick() {
		if (disconnecting) return;
		clearTimeout(confirmTimer);
		if (!confirmDisconnect) {
			confirmDisconnect = true;
			confirmTimer = setTimeout(() => (confirmDisconnect = false), 3000);
			return;
		}
		disconnectForm?.requestSubmit();
	}

	const submitDisconnect: SubmitFunction = ({ cancel }) => {
		if (disconnecting) return cancel();
		disconnecting = true;
		error = null;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				disconnecting = false;
				confirmDisconnect = false;
			}
		};
	};

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

{#snippet disconnectButton()}
	<button
		type="button"
		onclick={onDisconnectClick}
		disabled={disconnecting}
		class="btn btn-md {confirmDisconnect ? 'btn-danger' : 'btn-secondary hover:bg-bad-bg hover:text-bad'}"
	>
		{t(confirmDisconnect ? 'bitrix.panel.disconnectConfirm' : 'bitrix.panel.disconnect')}
	</button>
{/snippet}

<!-- Тот же collapsible, что у панели пароля. inert: в свёрнутую панель не попасть
     Tab-ом, и фокус по ?bitrix=1 ставится только после раскрытия -->
<div id="bitrix-panel" class="collapsible {open ? 'open' : ''}" inert={!open} data-testid="bitrix-panel">
<!-- Рамка и отступ на внуке: у ребёнка с overflow:hidden они бы остались видны и при 0fr -->
<div>
<div class="mt-7 rounded-2xl border border-border bg-surface-card p-4">
	<!-- Отключение — пустая форма: её отправляет вторым кликом кнопка через requestSubmit -->
	<form method="POST" action="?/bitrixDisconnect" bind:this={disconnectForm} use:enhance={submitDisconnect} class="hidden"></form>

	{#if bitrix && !bitrix.lastError}
		<!-- A3: подключено -->
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="min-w-0 max-w-full truncate text-sm font-semibold text-text-primary">
					{t('bitrix.panel.toggle')} · {bitrix.portal}
				</h2>
				<span class="badge badge-outline shrink-0">
					<svg class="h-3 w-3 text-well" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
					{t('bitrix.panel.connected')}
				</span>
			</div>

			<div class="flex items-center gap-3">
				<!-- Аватар владельца вебхука — чернильный инициал, как в шапке доски -->
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {initial ? 'bg-text-primary text-surface' : 'bg-surface-hover text-text-muted'}">
					{#if initial}
						<span class="text-[13px] font-bold leading-none">{initial}</span>
					{:else}
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
					{/if}
				</div>
				<div class="flex min-w-0 flex-col gap-[3px]">
					<p class="text-sm leading-[1.3] text-text-secondary">
						{t('bitrix.panel.createdBy')} <span class="font-semibold text-text-primary">{bitrix.userName}</span>
					</p>
					<p class="text-[13px] leading-[1.4] text-text-secondary">{t('bitrix.panel.createdByHint')}</p>
				</div>
			</div>

			{#if editingGroup}
				<form
					method="POST"
					action="?/bitrixSetGroup"
					bind:this={groupForm}
					use:enhance={submitGroupForm}
					aria-busy={savingGroup}
					class="flex flex-wrap items-center gap-2"
				>
					<label for="bitrix-group-edit" class="text-sm text-text-secondary">{t('bitrix.panel.defaultGroup')}</label>
					<input
						bind:this={editGroupInput}
						id="bitrix-group-edit"
						type="text"
						name="groupId"
						inputmode="numeric"
						autocomplete="off"
						maxlength="10"
						value={groupValue}
						readonly={savingGroup}
						oninput={(e) => (groupValue = digitsOnly(e.currentTarget))}
						onkeydown={onGroupKey}
						onblur={onGroupBlur}
						use:focusAndSelect
						class="input input-md w-32 {error?.field === 'groupId' ? 'border-bad' : ''} {shaking === 'groupId' ? 'animate-[shake_0.5s_ease]' : ''}"
					/>
					<!-- mousedown не забирает фокус у поля: иначе blur сохранил бы раньше, чем сработает «Отмена» -->
					<button type="button" onmousedown={(e) => e.preventDefault()} onclick={submitGroup} disabled={savingGroup} class="btn btn-dark btn-md">
						{t('bitrix.panel.save')}
					</button>
					<button type="button" onmousedown={(e) => e.preventDefault()} onclick={cancelGroupEdit} disabled={savingGroup} class="btn btn-secondary btn-md">
						{t('bitrix.panel.cancel')}
					</button>
					<span class="text-[13px] text-text-muted">{t('bitrix.panel.groupEmptyHint')}</span>
				</form>
			{:else}
				<div class="flex flex-wrap items-center gap-2 text-sm">
					<span class="text-text-secondary">{t('bitrix.panel.defaultGroup')}</span>
					{#if bitrix.groupId !== null}
						<span class="font-semibold text-text-primary">{bitrix.groupName ? `${bitrix.groupId} · ${bitrix.groupName}` : bitrix.groupId}</span>
					{:else}
						<span class="text-text-muted">{t('bitrix.panel.noGroup')}</span>
					{/if}
					<button
						type="button"
						onclick={startGroupEdit}
						class="btn-icon btn-icon-sm shrink-0"
						title={t('bitrix.panel.group')}
						aria-label={t('bitrix.panel.group')}
					>
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
					</button>
				</div>
			{/if}

			{#if groupNameUnavailable && bitrix.groupId !== null && !bitrix.groupName}
				<p class="text-[13px] text-text-muted">{t('bitrix.panel.groupNameUnavailable')}</p>
			{/if}
			{#if errorText}
				<p class="text-[13px] text-bad" role="alert">{errorText}</p>
			{/if}

			<div class="flex">{@render disconnectButton()}</div>
		</div>
	{:else}
		<!-- A1: не подключено; при lastError — та же форма для повторного подключения -->
		{#if bitrix?.lastError}
			<div class="error-box mb-3" role="alert">
				<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				{t('bitrix.panel.lastError')}
			</div>
		{/if}

		{#if !encryptionEnabled}
			<p class="text-sm text-text-secondary">{t('bitrix.panel.encryptionOff')}</p>
		{:else}
			<p class="mb-3 text-sm text-text-secondary">{t('bitrix.panel.intro')}</p>
			<!-- novalidate: у type=url своя браузерная подсказка перебила бы тексты ошибок панели.
			     Enter в любом поле — «Подключить» (неявная отправка формы) -->
			<form
				method="POST"
				action="?/bitrixConnect"
				novalidate
				use:enhance={submitConnect}
				aria-busy={connecting}
				class="flex flex-col gap-3"
			>
				<!-- Проверка: поля полупрозрачные и не кликаются, но остаются в форме (readonly, не disabled) -->
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end {connecting ? 'pointer-events-none opacity-50' : ''}">
					<div class="flex min-w-0 flex-1 flex-col gap-1.5">
						<label for="bitrix-webhook" class="text-sm font-semibold text-text-primary">{t('bitrix.panel.webhook')}</label>
						<input
							bind:this={webhookInput}
							id="bitrix-webhook"
							type="url"
							name="webhook"
							autocomplete="off"
							spellcheck="false"
							maxlength="500"
							readonly={connecting}
							placeholder={t('bitrix.panel.webhookPlaceholder')}
							class="input input-md {error?.field === 'webhook' ? 'border-bad' : ''} {shaking === 'webhook' ? 'animate-[shake_0.5s_ease]' : ''}"
						/>
					</div>
					<div class="flex flex-col gap-1.5 sm:w-[290px] sm:shrink-0">
						<label for="bitrix-group" class="text-sm font-semibold text-text-primary">{t('bitrix.panel.group')}</label>
						<input
							bind:this={connectGroupInput}
							id="bitrix-group"
							type="text"
							name="groupId"
							inputmode="numeric"
							autocomplete="off"
							maxlength="10"
							value={bitrix?.groupId ?? ''}
							readonly={connecting}
							oninput={(e) => digitsOnly(e.currentTarget)}
							class="input input-md {error?.field === 'groupId' ? 'border-bad' : ''} {shaking === 'groupId' ? 'animate-[shake_0.5s_ease]' : ''}"
						/>
					</div>
				</div>

				{#if errorText}
					<p class="text-[13px] text-bad" role="alert">{errorText}</p>
				{/if}
				<p class="text-[13px] text-text-muted">{t('bitrix.panel.hint')}</p>

				<div class="flex flex-wrap items-center gap-2">
					<button type="submit" disabled={connecting} class="btn btn-primary btn-md">
						{#if connecting}
							<svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
							{t('bitrix.panel.connecting')}
						{:else}
							{t('bitrix.panel.connect')}
						{/if}
					</button>
					<button type="button" onclick={onclose} class="btn btn-secondary btn-md">
						{t('bitrix.panel.cancel')}
					</button>
				</div>
			</form>
		{/if}

		{#if bitrix}
			<!-- Сломанное подключение можно убрать и без переподключения -->
			<div class="mt-4 flex">{@render disconnectButton()}</div>
		{/if}
	{/if}
</div>
</div>
</div>
