<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import { t } from '$lib/i18n/index.js';
	import { localeStore } from '$lib/stores/locale.svelte.js';

	type ChangeTag = 'feature' | 'fix' | 'improvement';
	interface Change { tag: ChangeTag; text: { en: string; ru: string } }
	interface Release { version: string; date: string; changes: Change[] }

	const releases: Release[] = [
		{
			version: '1.4.0',
			date: '2026-03-22',
			changes: [
				{ tag: 'feature', text: { en: 'Attach images to cards and comments', ru: 'Прикрепляйте фото к карточкам и комментариям' } },
				{ tag: 'feature', text: { en: 'Tap any image to view it fullscreen', ru: 'Нажмите на фото для полноэкранного просмотра' } },
				{ tag: 'feature', text: { en: 'Send us feedback right from the app', ru: 'Отправляйте нам отзывы прямо из приложения' } },
				{ tag: 'feature', text: { en: 'Changelog page — see what\'s new', ru: 'Страница обновлений — смотрите что нового' } },
				{ tag: 'improvement', text: { en: 'Smoother password toggle animation in spaces', ru: 'Плавная анимация переключения пароля в пространствах' } },
			]
		},
		{
			version: '1.3.0',
			date: '2026-03-19',
			changes: [
				{ tag: 'feature', text: { en: 'Manage space password — turn it on or off anytime', ru: 'Управляйте паролем пространства — включайте и отключайте в любой момент' } },
				{ tag: 'improvement', text: { en: 'Password is now optional when creating a space', ru: 'Пароль теперь необязателен при создании пространства' } },
			]
		},
		{
			version: '1.2.0',
			date: '2026-03-18',
			changes: [
				{ tag: 'feature', text: { en: 'New homepage — see how everything works at a glance', ru: 'Новая главная страница — узнайте как всё работает' } },
				{ tag: 'improvement', text: { en: 'Separate page for creating boards and spaces', ru: 'Отдельная страница для создания досок и пространств' } },
			]
		},
		{
			version: '1.1.0',
			date: '2026-03-17',
			changes: [
				{ tag: 'feature', text: { en: 'Fresh new look — redesigned cards, layout and colors', ru: 'Свежий дизайн — обновлённые карточки, раскладка и цвета' } },
				{ tag: 'feature', text: { en: 'Quick start guide for new users', ru: 'Быстрый старт для новых пользователей' } },
				{ tag: 'feature', text: { en: 'Set your name so teammates know who wrote what', ru: 'Укажите имя, чтобы коллеги видели кто что написал' } },
				{ tag: 'feature', text: { en: 'Discussion timer with visual countdown', ru: 'Таймер обсуждения с визуальным отсчётом' } },
				{ tag: 'fix', text: { en: 'Better error messages when entering wrong password', ru: 'Понятные сообщения при неверном пароле' } },
			]
		},
		{
			version: '1.0.0',
			date: '2026-03-15',
			changes: [
				{ tag: 'feature', text: { en: 'Create retro boards and collaborate in real-time', ru: 'Создавайте ретро-доски и работайте вместе в реальном времени' } },
				{ tag: 'feature', text: { en: 'Three columns: Went Well, Didn\'t Go Well, To Improve', ru: 'Три колонки: Что хорошо, Что не так, Что улучшить' } },
				{ tag: 'feature', text: { en: 'Vote and comment on cards', ru: 'Голосуйте и комментируйте карточки' } },
				{ tag: 'feature', text: { en: 'Group boards into spaces for your team', ru: 'Объединяйте доски в пространства для команды' } },
				{ tag: 'feature', text: { en: 'Dark mode', ru: 'Тёмная тема' } },
				{ tag: 'feature', text: { en: 'Export your retro to JSON or Markdown', ru: 'Экспортируйте ретро в JSON или Markdown' } },
				{ tag: 'feature', text: { en: 'Available in English and Russian', ru: 'Доступно на английском и русском' } },
			]
		}
	];

	const tagColors: Record<ChangeTag, string> = {
		feature: 'bg-accent/10 text-accent',
		fix: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
		improvement: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
	};

	let items: HTMLElement[] = [];
	let shown = $state<Record<string, boolean>>({});

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => entries.forEach((e) => { if (e.isIntersecting) shown[e.target.id] = true; }),
			{ threshold: 0.1 }
		);
		items.forEach((el) => el && observer.observe(el));
		return () => observer.disconnect();
	});

	function txt(change: Change) {
		return localeStore.locale === 'ru' ? change.text.ru : change.text.en;
	}
</script>

<svelte:head>
	<title>{t('changelog.title')} — {t('header.brand')}</title>
</svelte:head>

<div class="min-h-screen bg-surface">
	<Header showCreate />

	<!-- Hero -->
	<section class="px-6 pt-20 pb-12 text-center">
		<div class="mx-auto max-w-3xl" style="animation: fadeUp 0.8s cubic-bezier(0.25,1,0.5,1) both;">
			<div class="badge badge-outline mb-4 gap-2 px-4 py-1.5 text-[12px]">
				<svg class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
				v{releases[0].version}
			</div>
			<h1 class="font-heading text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">{t('changelog.title')}</h1>
			<p class="mt-4 text-lg text-text-secondary">{t('changelog.subtitle')}</p>
		</div>
	</section>

	<!-- Timeline -->
	<section class="px-6 pb-24">
		<div class="relative mx-auto max-w-3xl">
			<!-- Vertical line -->
			<div class="absolute left-[19px] top-0 bottom-0 w-px bg-border md:left-1/2 md:-translate-x-px"></div>

			{#each releases as release, ri}
				<div
					bind:this={items[ri]}
					id="r{ri}"
					class="relative mb-12 transition-all duration-700 {shown[`r${ri}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}"
					style="transition-delay: {ri * 100}ms"
				>
					<!-- Dot -->
					<div class="absolute left-3 top-1 h-3.5 w-3.5 rounded-full border-[3px] border-accent bg-surface md:left-1/2 md:-translate-x-1/2"></div>

					<!-- Content card -->
					<div class="ml-12 md:ml-0 md:w-[calc(50%-2rem)] {ri % 2 === 0 ? 'md:mr-auto' : 'md:ml-auto'}">
						<div class="card card-md card-interactive shadow-sm">
							<!-- Version + date -->
							<div class="mb-3 flex items-center gap-3">
								<span class="badge-version">v{release.version}</span>
								<span class="text-[13px] text-text-muted">{release.date}</span>
							</div>

							<!-- Changes -->
							<ul class="space-y-2.5">
								{#each release.changes as change}
									<li class="flex items-start gap-2.5">
										<span class="badge-sm mt-0.5 flex-shrink-0 {tagColors[change.tag]}">
											{t(`changelog.tag.${change.tag}`)}
										</span>
										<span class="text-[13px] leading-relaxed text-text-primary">{txt(change)}</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<footer class="border-t border-border px-6 py-8 text-center text-[12px] text-text-muted">
		{t('header.brand')} · {t('help.footer')}
	</footer>
</div>
