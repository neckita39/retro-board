<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';

	interface Release {
		version: string;
		date: string;
		title: { en: string; ru: string };
		changes: { en: string; ru: string }[];
	}

	const releases: Release[] = [
		{
			version: '1.7',
			date: '2026-07-04',
			title: { en: 'A fresh new look', ru: 'Новый облик' },
			changes: [
				{ en: 'Complete redesign — warm colors, new typography, more air', ru: 'Полный редизайн — тёплые цвета, новая типографика, больше воздуха' },
				{ en: 'Every action is visible — votes and comments are always-on pills, nothing hides behind hover', ru: 'Все действия на виду — голоса и комментарии стали постоянными кнопками, ничего не прячется под курсором' },
				{ en: 'Share button moved front and center in the header', ru: 'Кнопка «Поделиться» переехала из меню прямо в шапку' },
				{ en: 'Timer now lives in the header, visible to everyone', ru: 'Таймер теперь живёт в шапке и виден всем' },
				{ en: 'On phones: column tabs and a message-style composer at the bottom', ru: 'На телефоне: колонки-вкладки и поле ввода снизу, как в мессенджере' }
			]
		},
		{
			version: '1.6',
			date: '2026-07-04',
			title: { en: 'API for agents', ru: 'API для агентов' },
			changes: [
				{ en: 'API for agents — fetch any board as Markdown or JSON by URL, docs at /api', ru: 'API для агентов — получайте доску в Markdown или JSON по ссылке, дока на /api' },
				{ en: 'Comments are now available in the Summary list', ru: 'Комментарии теперь доступны в итоговом списке' },
				{ en: 'Move cards between columns', ru: 'Переносите карточки между колонками' },
				{ en: 'Sort any column by votes with one tap', ru: 'Сортируйте колонку по голосам в один клик' },
				{ en: 'Cards with comments now show a bright badge', ru: 'У карточек с комментариями теперь яркий индикатор' },
				{ en: 'Exports now include dislikes, images and dates', ru: 'В экспорт добавлены дизлайки, картинки и даты' },
				{ en: 'Deleting a card now asks for confirmation', ru: 'Удаление карточки теперь требует подтверждения' },
				{ en: 'Board reconnects automatically after a connection loss', ru: 'Доска автоматически переподключается после обрыва связи' },
				{ en: 'Boards are better protected from uninvited changes', ru: 'Доски лучше защищены от нежелательных изменений' }
			]
		},
		{
			version: '1.5',
			date: '2026-03-29',
			title: { en: 'A tidier interface', ru: 'Наведение порядка' },
			changes: [
				{ en: 'Polished interface — buttons, inputs and cards now look consistent everywhere', ru: 'Отполированный интерфейс — кнопки, поля ввода и карточки теперь выглядят одинаково везде' },
				{ en: 'Cleaner navigation — same header on every page', ru: 'Единая навигация — одинаковый хедер на каждой странице' },
				{ en: 'Less clutter — removed duplicate buttons and controls', ru: 'Меньше визуального шума — убраны дублирующиеся кнопки и элементы' },
				{ en: 'Boards in spaces now load correctly when navigating back', ru: 'Доски в пространствах теперь корректно загружаются при возврате назад' }
			]
		},
		{
			version: '1.4',
			date: '2026-03-22',
			title: { en: 'Images on cards', ru: 'Картинки в карточках' },
			changes: [
				{ en: 'Attach images to cards and comments', ru: 'Прикрепляйте фото к карточкам и комментариям' },
				{ en: 'Tap any image to view it fullscreen', ru: 'Нажмите на фото для полноэкранного просмотра' },
				{ en: 'Send us feedback right from the app', ru: 'Отправляйте нам отзывы прямо из приложения' },
				{ en: "Changelog page — see what's new", ru: 'Страница обновлений — смотрите что нового' }
			]
		},
		{
			version: '1.3',
			date: '2026-03-19',
			title: { en: 'Space passwords', ru: 'Пароли пространств' },
			changes: [
				{ en: 'Manage space password — turn it on or off anytime', ru: 'Управляйте паролем пространства — включайте и отключайте в любой момент' },
				{ en: 'Password is now optional when creating a space', ru: 'Пароль теперь необязателен при создании пространства' }
			]
		},
		{
			version: '1.2',
			date: '2026-03-18',
			title: { en: 'A new homepage', ru: 'Новая главная' },
			changes: [
				{ en: 'New homepage — see how everything works at a glance', ru: 'Новая главная страница — узнайте как всё работает' },
				{ en: 'Separate page for creating boards and spaces', ru: 'Отдельная страница для создания досок и пространств' }
			]
		},
		{
			version: '1.1',
			date: '2026-03-17',
			title: { en: 'Names and a timer', ru: 'Имена и таймер' },
			changes: [
				{ en: 'Fresh look — redesigned cards, layout and colors', ru: 'Свежий дизайн — обновлённые карточки, раскладка и цвета' },
				{ en: 'Quick start guide for new users', ru: 'Быстрый старт для новых пользователей' },
				{ en: 'Set your name so teammates know who wrote what', ru: 'Укажите имя, чтобы коллеги видели кто что написал' },
				{ en: 'Discussion timer with visual countdown', ru: 'Таймер обсуждения с визуальным отсчётом' }
			]
		},
		{
			version: '1.0',
			date: '2026-03-15',
			title: { en: 'First release', ru: 'Первый релиз' },
			changes: [
				{ en: 'Create retro boards and collaborate in real-time', ru: 'Создавайте ретро-доски и работайте вместе в реальном времени' },
				{ en: "Three columns: Went Well, Didn't Go Well, To Improve", ru: 'Три колонки: Что хорошо, Что не так, Что улучшить' },
				{ en: 'Vote and comment on cards', ru: 'Голосуйте и комментируйте карточки' },
				{ en: 'Group boards into spaces for your team', ru: 'Объединяйте доски в пространства для команды' },
				{ en: 'Dark mode', ru: 'Тёмная тема' },
				{ en: 'Export your retro to JSON or Markdown', ru: 'Экспортируйте ретро в JSON или Markdown' },
				{ en: 'Available in English and Russian', ru: 'Доступно на английском и русском' }
			]
		}
	];

	function txt(text: { en: string; ru: string }) {
		return localeStore.locale === 'ru' ? text.ru : text.en;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(localeStore.locale === 'ru' ? 'ru-RU' : 'en-US', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{t('changelog.title')} — {t('header.brand')}</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<Header showNav showCreate />

	<main class="mx-auto flex max-w-[760px] flex-col gap-8 px-4 pb-20 pt-12 sm:px-8 sm:pt-14">
		<div class="flex flex-col gap-2">
			<h1 class="font-heading text-[26px] font-bold tracking-[-0.02em] text-text-primary sm:text-[32px]">{t('changelog.heading')}</h1>
			<p class="text-base text-text-secondary">{t('changelog.subtitle')}</p>
		</div>

		<!-- Version timeline -->
		<div class="flex flex-col gap-8">
			{#each releases as release, i (release.version)}
				<div class="flex gap-4 sm:gap-5" style="animation: fadeUp 0.5s cubic-bezier(0.25, 1, 0.5, 1) {Math.min(i, 5) * 0.08}s both;">
					<div class="flex flex-col items-center pt-1">
						<span class={i === 0 ? 'badge-version' : 'badge-version-outline'}>{release.version}</span>
						{#if i < releases.length - 1}
							<div class="mt-2 w-0.5 flex-1 bg-border"></div>
						{/if}
					</div>
					<div class="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface-card p-5 sm:p-6">
						<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<span class="font-heading text-[17px] font-bold text-text-primary sm:text-[19px]">{txt(release.title)}</span>
							<span class="text-[13px] text-text-muted">{formatDate(release.date)}</span>
						</div>
						<ul class="list-disc space-y-1 pl-[18px] text-[15px] leading-[1.7] text-text-primary/85 marker:text-text-muted">
							{#each release.changes as change (change.en)}
								<li>{txt(change)}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/each}
		</div>
	</main>
</div>
