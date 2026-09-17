<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Seo from '$lib/components/Seo.svelte';
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
			version: '1.14',
			date: '2026-09-17',
			title: { en: 'Tasks in Bitrix24', ru: 'Задачи в Битрикс24' },
			changes: [
				{ en: 'Turn a retro card into a Bitrix24 task right from the board: press «To Bitrix24 task» on the card, check the prefilled form and press «Create task»', ru: 'Карточку ретро можно превратить в задачу Битрикс24 прямо с доски: нажмите «В задачу Битрикс24» на карточке, проверьте заполненную форму и нажмите «Создать задачу»' },
				{ en: 'The form fills itself in: the title is the first line of the card, the description has the card text, a link to the board, the author, votes and comments — edit anything before sending', ru: 'Форма заполняется сама: название — первая строка карточки, в описании текст карточки, ссылка на доску, автор, голоса и комментарии — перед отправкой всё можно поправить' },
				{ en: 'Pick a group, a deadline and mark the task as important; the retro tag is added automatically, and the card image is attached to the task as a file', ru: 'Можно указать группу, срок и отметить задачу важной; тег retro добавляется сам, а картинка карточки прикрепляется к задаче файлом' },
				{ en: 'Once created, the card shows a «Task #123» link — everyone on the board sees it at once, and it is also in the Summary and in the JSON and Markdown export', ru: 'После создания на карточке появляется ссылка «Задача #123» — её сразу видят все участники доски, она же есть в «Итогах» и в экспорте JSON и Markdown' },
				{ en: 'In discussion mode a task can be created straight from the Summary without interrupting the discussion', ru: 'В режиме обсуждения задачу можно поставить прямо из «Итогов», не прерывая обсуждение' },
				{ en: 'Bitrix24 is connected once per space: the space creator presses «Bitrix24» on the space page (or «Connect Bitrix24» in the board menu) and pastes the connection link from the portal — the hint on where to get it is right there. The link is stored encrypted and never shown again', ru: 'Битрикс24 подключается один раз на пространство: создатель пространства нажимает «Битрикс24» на странице пространства (или «Подключить Битрикс24» в меню доски) и вставляет ссылку для подключения из портала — подсказка, где её взять, там же. Ссылка хранится зашифрованной и больше не показывается' },
				{ en: 'Tasks are created on behalf of whoever connected the portal — they are both the creator and the responsible person. Only the board creator and the space creator see the button, on regular boards and on AI analysis boards alike', ru: 'Задачи ставятся от имени того, кто подключил портал, — он и постановщик, и ответственный. Кнопку видят только создатель доски и создатель пространства — на обычных досках и на досках AI-анализа' },
				{ en: 'Card icons now show a hint on hover', ru: 'У иконок на карточке появились подсказки при наведении' },
				{ en: 'Password-protected spaces are better protected: after the update you may need to enter the space password once more', ru: 'Пространства с паролем защищены надёжнее: после обновления пароль, возможно, придётся ввести ещё раз' }
			]
		},
		{
			version: '1.13',
			date: '2026-09-16',
			title: { en: 'One consistent style', ru: 'Единый стиль' },
			changes: [
				{ en: 'The board header is tidier: the timer, participants, «Share» and the menu are now the same height and sit in one neat row', ru: 'Шапка доски стала аккуратнее: таймер, участники, «Поделиться» и меню теперь одного роста и стоят в одну ровную строку' },
				{ en: 'The name prompt and the quick tip for newcomers are one card under the header instead of two separate blocks', ru: 'Вопрос про имя и подсказка для новичков объединены в одну карточку под шапкой вместо двух отдельных блоков' },
				{ en: '«Add a card…» is now a dashed field at the top of each column, and your avatar is ink-black — green and red are left to the columns', ru: '«Добавить карточку…» стало пунктирным полем сверху колонки, а ваш аватар — чернильным: зелёный и красный остались колонкам' },
				{ en: 'Comment counters on cards are neutral grey — terracotta now marks only what you can press, and the timer', ru: 'Счётчик комментариев на карточке стал нейтральным серым — терракотовым остаётся только то, что можно нажать, и таймер' },
				{ en: 'The Summary is easier to read: the card being discussed has a clear frame, the others are dimmed, and «Discussing · 2 of 8» is visible to everyone', ru: '«Итоги» стало легче читать: обсуждаемая карточка в чёткой рамке, остальные приглушены, а ход обсуждения «2 из 8» виден всем' },
				{ en: 'One notification style everywhere: «Board created» now appears top-right with a «Copy link» button instead of a banner at the bottom of the screen', ru: 'Уведомления теперь единого вида: «Доска создана» показывается справа сверху с кнопкой «Скопировать ссылку», а не баннером внизу экрана' },
				{ en: 'Space page: the name is shown once, the password switch has a label, the analysis button is calmer, and the analysis tile has a blue frame instead of a purple gradient', ru: 'Страница пространства: название показывается один раз, у переключателя пароля появилась подпись, кнопка анализа стала спокойнее, а плитка анализа получила синюю рамку вместо фиолетового градиента' },
				{ en: 'Creating a board: the selected option is framed in terracotta, the column stripes are solid, the fourth column of 4L and Sailboat is plum, and the AI feature has its own badge', ru: 'Создание доски: выбранный вариант обведён терракотовой рамкой, полоски колонок стали сплошными, четвёртая колонка в 4L и Sailboat — сливовая, а у AI-функции появился свой бейдж' }
			]
		},
		{
			version: '1.12',
			date: '2026-09-16',
			title: { en: 'Space analysis', ru: 'Анализ пространства' },
			changes: [
				{ en: 'A «Space analysis» button on a space and on its boards: AI reads the recent cards from all retros of the space and shows what keeps going well, what keeps going badly and what the team keeps wanting to improve', ru: 'Кнопка «Анализ пространства» в пространстве и на его досках: AI читает последние карточки всех ретро пространства и показывает, что снова хорошо, что снова плохо и что команда снова хочет улучшить' },
				{ en: 'The analysis runs in the background: everyone in the space sees a loading tile, and a notification with an «Open» button arrives when it is ready — keep working meanwhile', ru: 'Анализ идёт в фоне: все в пространстве видят плитку с лоадером, а по готовности приходит уведомление с кнопкой «Открыть» — можно продолжать работать' },
				{ en: 'The result is a regular board with a purple frame — walk through it with the team, vote and comment as usual', ru: 'Результат — обычная доска с фиолетовой рамкой: по ней можно пройтись с командой, голосовать и комментировать как обычно' },
				{ en: 'The analysis is rerun only after a new board appears in the space, and no more than three times a day', ru: 'Анализ пересчитывается только после появления новой доски в пространстве и не чаще трёх раз в сутки' },
				{ en: 'API: the list of a space’s boards and all its AI analyses as JSON or Markdown — see the API page', ru: 'API: список досок пространства и все его AI-анализы в JSON или Markdown — см. страницу API' },
				{ en: 'The space creator now has creator rights on every board in the space', ru: 'Создатель пространства теперь имеет права создателя на всех досках пространства' }
			]
		},
		{
			version: '1.11',
			date: '2026-09-16',
			title: { en: 'Rename anything', ru: 'Переименование' },
			changes: [
				{ en: 'The board creator can rename it: pick «Rename board» in the menu, and everyone on the board sees the new title instantly', ru: 'Создатель доски может её переименовать: пункт «Переименовать доску» в меню — новое название сразу видят все участники' },
				{ en: 'A space can be renamed too — the pencil next to its name', ru: 'Пространство тоже можно переименовать — карандаш рядом с названием' }
			]
		},
		{
			version: '1.10',
			date: '2026-09-08',
			title: { en: 'Pick a format', ru: 'Выбор формата' },
			changes: [
				{ en: 'When creating a board you can pick its format: Start Stop Continue, Mad Sad Glad, 4L or Sailboat — the columns match the format', ru: 'При создании доски можно выбрать её формат: Start Stop Continue, Mad Sad Glad, 4L или Sailboat — колонки подстраиваются под формат' },
				{ en: 'The classic board is preselected and marked as recommended, so nothing changes if you just press «Create»', ru: 'Классическая доска выбрана заранее и помечена как рекомендуемая — если просто нажать «Создать», ничего не поменяется' },
				{ en: 'The browser remembers your last format, and a space suggests the format of its previous board', ru: 'Браузер запоминает последний формат, а пространство предлагает формат предыдущей доски' },
				{ en: 'Every format page now has a «Create a board in this format» button', ru: 'На каждой странице формата появилась кнопка «Создать доску в этом формате»' },
				{ en: 'Cards can be dragged between columns with the mouse', ru: 'Карточки можно перетаскивать между колонками мышью' },
				{ en: 'The Summary shows who wrote each card', ru: 'В «Итогах» видно, кто написал карточку' }
			]
		},
		{
			version: '1.9',
			date: '2026-08-16',
			title: { en: 'Guides and formats', ru: 'Гайды и форматы' },
			changes: [
				{ en: 'A step-by-step guide on how to run a retrospective — with timings for each stage and the mistakes that quietly ruin the meeting', ru: 'Пошаговый гайд «Как провести ретроспективу» — с таймингом каждого этапа и ошибками, которые тихо ломают встречу' },
				{ en: 'A section on retrospective formats: Start Stop Continue, Mad Sad Glad, 4L and Sailboat — what each is for, when to pick it and how to facilitate it', ru: 'Раздел о форматах ретроспективы: Start Stop Continue, Mad Sad Glad, 4L и Sailboat — зачем каждый, когда его брать и как провести' },
				{ en: 'The header no longer overlaps itself on iPhone — the site name used to run into the icons', ru: 'Шапка больше не наезжает сама на себя на айфоне — название сайта налезало на иконки' },
				{ en: 'Pages load faster: fonts now come from our own server instead of a third-party one', ru: 'Страницы загружаются быстрее: шрифты теперь отдаёт наш сервер, а не сторонний' },
				{ en: 'Links to the site now unfurl with a proper preview card in messengers', ru: 'Ссылки на сайт теперь разворачиваются в мессенджерах нормальной карточкой с превью' }
			]
		},
		{
			version: '1.8',
			date: '2026-07-26',
			title: { en: 'One card at a time', ru: 'По одной карточке' },
			changes: [
				{ en: 'Discussion mode — press «Discuss» in the Summary and everyone’s screen focuses on the same card', ru: 'Режим обсуждения — нажмите «Обсудить» в «Итогах», и у всех участников подсветится одна и та же карточка' },
				{ en: 'A five-minute timer sits next to the card being discussed and starts over on every new one', ru: 'Рядом с обсуждаемой карточкой идёт пятиминутный таймер и начинается заново на каждой новой' },
				{ en: 'Cards you have already been through get a checkmark, so nothing gets skipped', ru: 'Пройденные карточки помечаются галочкой — ничего не потеряется' },
				{ en: 'A card’s weight in the Summary is now likes minus dislikes, shown as 7 (17/-10) — objections finally count', ru: 'Вес карточки в «Итогах» теперь считается как лайки минус дизлайки и показывается в виде 7 (17/-10) — возражения наконец учитываются' },
				{ en: 'Sorting a column by votes uses the same number', ru: 'Сортировка колонки по голосам считает так же' },
				{ en: 'The participants counter in the header no longer breaks on large teams', ru: 'Счётчик участников в шапке больше не разъезжается на больших командах' }
			]
		},
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

<Seo
	title="{t('changelog.title')} — {t('header.brand')}"
	description={t('changelog.seo.description')}
	path="/changelog"
/>

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
						<ul class="list-disc space-y-1 pl-[18px] text-[15px] leading-[1.7] text-text-primary marker:text-text-muted">
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
