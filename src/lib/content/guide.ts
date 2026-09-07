/**
 * Гайд «Как провести ретроспективу» — контент для /how-to-run-a-retro.
 *
 * Целевая страница под информационный интент: человек ищет инструкцию, а не
 * лендинг продукта. Тексты инлайном парами { en, ru }, как в /changelog.
 */

import type { Localized } from './localized.js';

export interface GuideStep {
	/** Сколько минут занимает шаг на встрече в час */
	minutes: number;
	title: Localized;
	body: Localized;
}

export interface GuideFaq {
	question: Localized;
	answer: Localized;
}

export const GUIDE_INTRO: Localized = {
	en: 'A retrospective is the meeting where a team decides what to change about how it works. It is not a status report and not a post-mortem. Most retros fail the same way: everyone talks for an hour, everyone agrees things could be better, and nothing is different next sprint. This guide is the sequence that prevents that.',
	ru: 'Ретроспектива — встреча, на которой команда решает, что изменить в том, как она работает. Это не отчёт о статусе и не разбор инцидента. Большинство ретро проваливаются одинаково: час разговоров, общее согласие, что могло быть лучше, и ровно ноль отличий в следующем спринте. Этот гайд — последовательность, которая такого не допускает.'
};

export const GUIDE_STEPS: GuideStep[] = [
	{
		minutes: 5,
		title: { en: 'Set the frame', ru: 'Задайте рамку' },
		body: {
			en: 'Name the period you are looking at and the one rule: we discuss situations, not people. Say out loud that nothing leaves the room. Thirty seconds of this changes what people are willing to write for the next hour.',
			ru: 'Назовите период, который разбираете, и одно правило: обсуждаем ситуации, а не людей. Проговорите вслух, что ничего не выйдет за пределы встречи. Тридцать секунд на это меняют то, что люди готовы писать весь следующий час.'
		}
	},
	{
		minutes: 10,
		title: { en: 'Write in silence', ru: 'Пишите молча' },
		body: {
			en: 'Everyone fills the board at the same time, without talking. This is the single most important step. If the discussion starts first, the first opinion voiced becomes the frame everyone else responds to, and the quiet half of the team writes nothing of their own.',
			ru: 'Все заполняют доску одновременно и молча. Это самый важный шаг. Если начать с обсуждения, первое озвученное мнение станет рамкой, на которую отвечают остальные, и тихая половина команды не напишет ничего своего.'
		}
	},
	{
		minutes: 10,
		title: { en: 'Read everything out loud', ru: 'Прочитайте всё вслух' },
		body: {
			en: 'Go card by card. The author clarifies what they meant; nobody argues and nobody solves anything yet. The goal here is only that every person in the room understands every card.',
			ru: 'Идите по карточкам подряд. Автор поясняет, что имел в виду; никто пока не спорит и ничего не решает. Единственная цель этого шага — чтобы каждый в комнате понял каждую карточку.'
		}
	},
	{
		minutes: 5,
		title: { en: 'Group and vote', ru: 'Сгруппируйте и проголосуйте' },
		body: {
			en: 'Merge duplicates — four cards about the same slow build are one problem with four votes. Then everyone gets two or three votes. Voting is what turns twenty cards into the three that are actually worth an hour of the team’s attention.',
			ru: 'Объедините дубли — четыре карточки про одну медленную сборку это одна проблема с четырьмя голосами. Затем каждый получает два-три голоса. Именно голосование превращает двадцать карточек в те три, что действительно стоят часа внимания команды.'
		}
	},
	{
		minutes: 20,
		title: { en: 'Discuss the top cards only', ru: 'Обсуждайте только верхние карточки' },
		body: {
			en: 'Take them in order of votes and stop when the time runs out. A retro that touched every card changes nothing; a retro that went deep on two changes two things. For each one, keep asking why until you hit something the team can actually influence.',
			ru: 'Берите их по убыванию голосов и останавливайтесь, когда кончилось время. Ретро, которое коснулось всех карточек, не меняет ничего; ретро, которое копнуло две, меняет две вещи. По каждой спрашивайте «почему», пока не упрётесь во что-то, на что команда реально влияет.'
		}
	},
	{
		minutes: 10,
		title: { en: 'Write down actions with owners', ru: 'Запишите действия с ответственными' },
		body: {
			en: 'Every decision becomes a line with a name and a date. Not «improve the documentation» but «Ira writes the deploy checklist by Friday». Two or three actions is the right number — a list of ten is a list nobody starts.',
			ru: 'Каждое решение превращается в строку с именем и датой. Не «улучшить документацию», а «Ира пишет чек-лист деплоя до пятницы». Два-три действия — правильное количество; список из десяти это список, к которому никто не приступит.'
		}
	},
	{
		minutes: 5,
		title: { en: 'Check last time’s actions', ru: 'Проверьте прошлые действия' },
		body: {
			en: 'Open the previous retro and go through what was promised. This is the step teams skip, and skipping it is precisely why retros stop being taken seriously. If nothing from last time got done, that is your topic for today.',
			ru: 'Откройте прошлое ретро и пройдитесь по обещанному. Этот шаг обычно пропускают — и именно поэтому ретро перестают воспринимать всерьёз. Если с прошлого раза не сделано ничего, вот вам и тема на сегодня.'
		}
	}
];

export const GUIDE_MISTAKES: Localized[] = [
	{
		en: 'The manager speaks first. Everything after that is a response to the manager, not to the sprint.',
		ru: 'Руководитель высказывается первым. Всё дальнейшее — это ответ руководителю, а не разбор спринта.'
	},
	{
		en: 'No actions, only conclusions. «We should communicate better» is not something anyone can start on Monday.',
		ru: 'Никаких действий, одни выводы. «Нам надо лучше общаться» — это не то, к чему можно приступить в понедельник.'
	},
	{
		en: 'Every card gets discussed. The clock runs out somewhere in the middle and the important ones were at the bottom.',
		ru: 'Обсуждаются все карточки подряд. Время кончается где-то на середине, а важные лежали внизу.'
	},
	{
		en: 'The same format forever. After the sixth identical retro people fill the board on autopilot.',
		ru: 'Один и тот же формат всегда. К шестому одинаковому ретро доску заполняют на автопилоте.'
	},
	{
		en: 'Blame instead of causes. The moment a name is the answer, the next retro will be silent.',
		ru: 'Поиск виноватого вместо причин. Как только ответом становится имя, следующее ретро пройдёт в тишине.'
	}
];

export const GUIDE_FAQ: GuideFaq[] = [
	{
		question: { en: 'How long should a retrospective take?', ru: 'Сколько должна длиться ретроспектива?' },
		answer: {
			en: 'An hour for a two-week sprint, ninety minutes for a month. Under forty minutes there is no time to get past the first, most obvious layer of problems.',
			ru: 'Час на двухнедельный спринт, полтора на месяц. Меньше сорока минут не хватает, чтобы пройти дальше первого, самого очевидного слоя проблем.'
		}
	},
	{
		question: { en: 'How often should we run one?', ru: 'Как часто проводить ретро?' },
		answer: {
			en: 'At the end of every sprint. If you do not work in sprints, once every two to four weeks. Less often than monthly and people no longer remember what happened.',
			ru: 'В конце каждого спринта. Если спринтов нет — раз в две–четыре недели. Реже раза в месяц люди уже не помнят, что происходило.'
		}
	},
	{
		question: { en: 'Who should facilitate?', ru: 'Кто должен вести встречу?' },
		answer: {
			en: 'Anyone except the person who evaluates the team. Rotating the role each time works well: it spreads the skill and stops the retro from becoming one person’s meeting.',
			ru: 'Кто угодно, кроме того, кто оценивает команду. Хорошо работает ротация роли: навык расходится по команде, и ретро перестаёт быть встречей одного человека.'
		}
	},
	{
		question: { en: 'Does it work with a remote team?', ru: 'Работает ли это с распределённой командой?' },
		answer: {
			en: 'Better than in a room, if everyone writes on a shared board at once. Silent writing removes the advantage the loudest person has on a call, and everyone reads the same text at the same time.',
			ru: 'Лучше, чем в переговорке, если все пишут на общей доске одновременно. Молчаливое письмо снимает преимущество самого громкого участника созвона, и все читают один и тот же текст в одно время.'
		}
	},
	{
		question: {
			en: 'What if the team stays silent?',
			ru: 'Что делать, если команда молчит?'
		},
		answer: {
			en: 'Silence is data, not stubbornness — usually it means the last honest remark had consequences. Start with anonymous cards and a format that asks about feelings rather than process, and fix something small from the first retro fast enough that people see it worked.',
			ru: 'Молчание — это данные, а не упрямство: обычно оно означает, что за прошлое честное высказывание что-то прилетело. Начните с анонимных карточек и формата, который спрашивает про ощущения, а не про процесс, и почините что-нибудь мелкое с первого же ретро достаточно быстро, чтобы люди увидели: сработало.'
		}
	},
	{
		question: {
			en: 'Do we need a special tool?',
			ru: 'Нужен ли отдельный инструмент?'
		},
		answer: {
			en: 'You need simultaneous writing, voting and a place the actions live until next time. A spreadsheet does the first two badly and the third not at all. A dedicated board does all three and takes a link to join.',
			ru: 'Нужны одновременное письмо, голосование и место, где действия доживут до следующего раза. Таблица плохо делает первые два и совсем не делает третье. Отдельная доска делает все три, а подключение — по ссылке.'
		}
	}
];
