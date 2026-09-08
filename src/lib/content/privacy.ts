/**
 * Политика конфиденциальности — /privacy.
 *
 * Написана человеческим языком и отражает то, как сервис устроен на самом
 * деле. Меняешь обработку данных — обнови соответствующую секцию.
 */

import type { Localized } from './localized.js';

/** Дата последнего обновления политики (показывается на странице). */
export const PRIVACY_UPDATED = '2026-09-08';

export const PRIVACY_INTRO: Localized = {
	en: 'Retrospectrix collects as little as possible: the service works without accounts, so it simply has no reason to ask who you are. This page describes what data appears in the service and what happens to it.',
	ru: 'Ретроспектрикс собирает настолько мало данных, насколько возможно: сервис работает без аккаунтов, поэтому ему просто незачем спрашивать, кто вы. На этой странице описано, какие данные появляются в сервисе и что с ними происходит.'
};

export const PRIVACY_SECTIONS: { title: Localized; body: Localized }[] = [
	{
		title: { en: 'Boards, cards and comments', ru: 'Доски, карточки и комментарии' },
		body: {
			en: 'Everything you write on a board is stored in our database so the whole team sees it. Card and comment texts are encrypted at rest (AES-256-GCM). A board is available only at its unguessable link: it is not listed anywhere and is closed to search engines. Anyone you share the link with can open the board — treat the link as the key.',
			ru: 'Всё, что вы пишете на доске, хранится в нашей базе, чтобы это видела вся команда. Тексты карточек и комментариев шифруются при хранении (AES-256-GCM). Доска доступна только по неугадываемой ссылке: она нигде не публикуется и закрыта от поисковиков. Любой, у кого есть ссылка, может открыть доску — относитесь к ссылке как к ключу.'
		}
	},
	{
		title: { en: 'Your name', ru: 'Ваше имя' },
		body: {
			en: 'The name you enter is kept in your browser and attached to the cards and comments you create, so teammates can see who wrote what. You can leave it empty or use any alias — the service does not verify it.',
			ru: 'Имя, которое вы вводите, хранится в вашем браузере и подписывается под вашими карточками и комментариями, чтобы команда видела, кто что написал. Его можно не указывать или указать любой псевдоним — сервис его никак не проверяет.'
		}
	},
	{
		title: { en: 'Images', ru: 'Картинки' },
		body: {
			en: 'Images attached to cards and comments are compressed and stored in the database next to the board. They are served only by their own unguessable identifiers.',
			ru: 'Картинки, прикреплённые к карточкам и комментариям, сжимаются и хранятся в базе рядом с доской. Отдаются только по собственным неугадываемым идентификаторам.'
		}
	},
	{
		title: { en: 'Cookies and local storage', ru: 'Куки и локальное хранилище' },
		body: {
			en: 'The service sets one technical session cookie (retro_visit) to count unique visits. Your language, theme and name live in the browser localStorage and never leave your device by themselves. There are no advertising or cross-site trackers.',
			ru: 'Сервис ставит одну техническую сессионную куку (retro_visit), чтобы считать уникальные визиты. Язык, тема и имя живут в localStorage браузера и сами по себе никуда не отправляются. Рекламных и сквозных трекеров нет.'
		}
	},
	{
		title: { en: 'Analytics', ru: 'Аналитика' },
		body: {
			en: 'We count anonymous aggregate numbers: how many visits came from the web and from which source class (search, social, direct). No profiles, no identifiers tied to a person, no third-party analytics services.',
			ru: 'Мы считаем анонимные агрегированные числа: сколько визитов пришло из интернета и из какого класса источников (поиск, соцсети, прямые заходы). Без профилей, без привязанных к человеку идентификаторов и без сторонних аналитических сервисов.'
		}
	},
	{
		title: { en: 'Feedback', ru: 'Обратная связь' },
		body: {
			en: 'Messages from the feedback form are delivered to the author as private messenger notifications. Include contact details only if you want a reply.',
			ru: 'Сообщения из формы обратной связи приходят автору как личные уведомления в мессенджере. Оставляйте контакты, только если хотите получить ответ.'
		}
	},
	{
		title: { en: 'Deleting data', ru: 'Удаление данных' },
		body: {
			en: 'The board creator can delete the board — this permanently removes its cards, comments and images. If you want data removed and cannot do it yourself, write to the author and mention the board link.',
			ru: 'Создатель доски может её удалить — вместе с ней навсегда удаляются карточки, комментарии и картинки. Если нужно удалить данные, а сами вы не можете, напишите автору и укажите ссылку на доску.'
		}
	}
];
