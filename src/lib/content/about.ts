/**
 * Страница «О проекте» — /about.
 *
 * Трастовый сигнал для поисковиков и просто честный ответ на вопрос
 * «кто это сделал и зачем». Тексты инлайном парами { en, ru }, как в гайде.
 */

import type { Localized } from './localized.js';

/** Автор указывается в футере и на странице «О проекте». */
export const AUTHOR_NAME: Localized = { en: 'Nikita Shcherbo', ru: 'Никита Щербо' };
export const AUTHOR_EMAIL = 'nikita.kantiana@gmail.com';

export const ABOUT_INTRO: Localized = {
	en: 'Retrospectrix is a free online board for team retrospectives. A board is created in one click and shared with a link — participants join without registration, email or trial limits. Cards, votes, comments and the discussion mode update for everyone in real time.',
	ru: 'Ретроспектрикс — бесплатная онлайн-доска для командных ретроспектив. Доска создаётся в один клик и раздаётся ссылкой — участники заходят без регистрации, почты и триальных ограничений. Карточки, голоса, комментарии и режим обсуждения обновляются у всех в реальном времени.'
};

export const ABOUT_STORY: Localized[] = [
	{
		en: 'The project grew out of one specific irritation: to run a 45-minute meeting, most tools ask you to register, confirm an email, create a workspace and invite everyone one by one. By the time the whole team is in, half the meeting is gone.',
		ru: 'Проект вырос из одного конкретного раздражения: чтобы провести встречу на 45 минут, большинство инструментов просят зарегистрироваться, подтвердить почту, создать воркспейс и позвать всех по одному. К моменту, когда вся команда внутри, половины встречи уже нет.'
	},
	{
		en: 'So Retrospectrix is built around the opposite idea: press a button, get a link, drop it into the team chat — and everyone is already on the board. The tool should take minutes of your time, not meetings.',
		ru: 'Поэтому Ретроспектрикс построен вокруг обратной идеи: нажал кнопку, получил ссылку, скинул в чат команды — и все уже на доске. Инструмент должен занимать минуты, а не встречи.'
	},
	{
		en: 'It is an independent project by a single developer, free and without feature limits. It grows on feedback from real teams — the feedback form is the fastest way to influence what gets built next.',
		ru: 'Это независимый проект одного разработчика — бесплатный и без ограничений по функциям. Он растёт на отзывах реальных команд: форма обратной связи — самый быстрый способ повлиять на то, что появится дальше.'
	}
];

export const ABOUT_PRINCIPLES: { title: Localized; body: Localized }[] = [
	{
		title: { en: 'No registration', ru: 'Без регистрации' },
		body: {
			en: 'Neither the facilitator nor the participants create accounts. A board lives at an unguessable link.',
			ru: 'Ни ведущий, ни участники не заводят аккаунтов. Доска живёт по неугадываемой ссылке.'
		}
	},
	{
		title: { en: 'Private by default', ru: 'Приватность по умолчанию' },
		body: {
			en: 'Card and comment texts are stored encrypted, boards are closed to search engines, and there are no ad trackers.',
			ru: 'Тексты карточек и комментариев хранятся в зашифрованном виде, доски закрыты от поисковиков, рекламных трекеров нет.'
		}
	},
	{
		title: { en: 'Process over features', ru: 'Процесс важнее фич' },
		body: {
			en: 'The timer per card, vote-sorted agenda and focus mode exist to keep the meeting on rails — not to grow a feature list.',
			ru: 'Таймер на карточку, повестка по голосам и режим фокуса существуют, чтобы держать встречу на рельсах, а не ради длинного списка возможностей.'
		}
	}
];
