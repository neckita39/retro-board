<script lang="ts">
	import { onMount } from 'svelte';
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
				{ tag: 'feature', text: { en: 'Image attachments — attach photos to cards and comments', ru: 'Вложения — прикрепляйте фото к карточкам и комментариям' } },
				{ tag: 'feature', text: { en: 'Lightbox — click any image to view fullscreen with smooth animation', ru: 'Лайтбокс — клик по фото открывает полноэкранный просмотр' } },
				{ tag: 'feature', text: { en: 'Feedback form — send us your thoughts directly from the app', ru: 'Форма обратной связи — пишите нам прямо из приложения' } },
				{ tag: 'improvement', text: { en: 'Password toggle with smooth animations on space admin page', ru: 'Плавный переключатель пароля на странице пространства' } },
				{ tag: 'improvement', text: { en: 'Reusable ToggleSwitch component with spring overshoot', ru: 'Переиспользуемый тумблер с пружинной анимацией' } },
				{ tag: 'fix', text: { en: 'Fixed undefined CSS variable on password panel', ru: 'Исправлена неопределённая CSS-переменная на панели пароля' } },
			]
		},
		{
			version: '1.3.0',
			date: '2026-03-19',
			changes: [
				{ tag: 'feature', text: { en: 'Space admin panel — enable/disable password with verification', ru: 'Панель администратора — включение/отключение пароля с проверкой' } },
				{ tag: 'feature', text: { en: 'Optional password for spaces', ru: 'Необязательный пароль для пространств' } },
				{ tag: 'improvement', text: { en: 'Type parameter for /new route — deep link to space creation', ru: 'Параметр type для /new — прямая ссылка на создание пространства' } },
			]
		},
		{
			version: '1.2.0',
			date: '2026-03-18',
			changes: [
				{ tag: 'feature', text: { en: 'Landing page with animated feature showcase', ru: 'Лендинг с анимированным обзором возможностей' } },
				{ tag: 'improvement', text: { en: 'Moved create form to /new route', ru: 'Форма создания перенесена на /new' } },
			]
		},
		{
			version: '1.1.0',
			date: '2026-03-17',
			changes: [
				{ tag: 'feature', text: { en: 'Complete UI redesign — new card style, spacing, typography', ru: 'Полный редизайн — новые карточки, отступы, типографика' } },
				{ tag: 'feature', text: { en: 'Onboarding flow for new users', ru: 'Онбординг для новых пользователей' } },
				{ tag: 'feature', text: { en: 'Name prompt — set your display name', ru: 'Запрос имени — укажите отображаемое имя' } },
				{ tag: 'feature', text: { en: 'Timer stepper with visual progress bar', ru: 'Таймер-степпер с визуальным прогресс-баром' } },
				{ tag: 'fix', text: { en: 'Password error display — red border + inline text', ru: 'Отображение ошибки пароля — красная рамка + текст' } },
			]
		},
		{
			version: '1.0.0',
			date: '2026-03-15',
			changes: [
				{ tag: 'feature', text: { en: 'Real-time retrospective boards with Socket.IO', ru: 'Ретро-доски в реальном времени на Socket.IO' } },
				{ tag: 'feature', text: { en: 'Three columns: Went Well, Didn\'t Go Well, To Improve', ru: 'Три колонки: Что хорошо, Что не так, Что улучшить' } },
				{ tag: 'feature', text: { en: 'Voting and comments on cards', ru: 'Голосование и комментарии к карточкам' } },
				{ tag: 'feature', text: { en: 'Spaces — group boards together', ru: 'Пространства — объединяйте доски' } },
				{ tag: 'feature', text: { en: 'Dark mode with smooth transitions', ru: 'Тёмная тема с плавными переходами' } },
				{ tag: 'feature', text: { en: 'Export to JSON and Markdown', ru: 'Экспорт в JSON и Markdown' } },
				{ tag: 'feature', text: { en: 'i18n — English and Russian', ru: 'i18n — английский и русский' } },
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
	<header class="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md px-6 py-3">
		<div class="mx-auto flex max-w-3xl items-center justify-between">
			<a href="/" class="font-heading text-[15px] font-bold text-text-primary">{t('header.brand')}</a>
			<a href="/new" class="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover">
				{t('home.create')}
			</a>
		</div>
	</header>

	<!-- Hero -->
	<section class="px-6 pt-20 pb-12 text-center">
		<div class="mx-auto max-w-3xl" style="animation: fadeUp 0.8s cubic-bezier(0.25,1,0.5,1) both;">
			<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-[12px] font-medium text-text-secondary">
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
						<div class="rounded-2xl border border-border bg-surface-card p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-border-strong">
							<!-- Version + date -->
							<div class="mb-3 flex items-center gap-3">
								<span class="rounded-lg bg-accent px-2.5 py-1 text-[13px] font-bold text-white">v{release.version}</span>
								<span class="text-[13px] text-text-muted">{release.date}</span>
							</div>

							<!-- Changes -->
							<ul class="space-y-2.5">
								{#each release.changes as change}
									<li class="flex items-start gap-2.5">
										<span class="mt-0.5 flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide {tagColors[change.tag]}">
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
