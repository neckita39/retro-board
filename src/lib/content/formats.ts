/**
 * Форматы ретроспективы — контент для /formats и /formats/[format].
 *
 * Длинные тексты лежат инлайном парами { en, ru }, как в /changelog: словари
 * i18n держат обвязку интерфейса, а не статьи. Правило «строки через t()»
 * осталось за кнопками и заголовками страниц.
 */

import type { Localized } from './localized.js';

export type { Localized };

export interface FormatColumn {
	title: Localized;
	hint: Localized;
}

export interface RetroFormat {
	slug: string;
	name: Localized;
	tagline: Localized;
	/** Сколько длится встреча по этому формату, в минутах */
	minutes: number;
	/** Размер команды, на котором формат работает лучше всего */
	teamSize: Localized;
	seoTitle: Localized;
	seoDescription: Localized;
	intro: Localized;
	whenToUse: Localized[];
	columns: FormatColumn[];
	steps: Localized[];
	watchOut: Localized;
}

export const FORMATS: RetroFormat[] = [
	{
		slug: 'start-stop-continue',
		name: { en: 'Start Stop Continue', ru: 'Start Stop Continue' },
		tagline: {
			en: 'The shortest path from talk to action',
			ru: 'Самый короткий путь от разговора к действию'
		},
		minutes: 45,
		teamSize: { en: '3–10 people', ru: '3–10 человек' },
		seoTitle: {
			en: 'Start Stop Continue retrospective online — free board',
			ru: 'Ретроспектива Start Stop Continue онлайн — бесплатная доска'
		},
		seoDescription: {
			en: 'How to run a Start Stop Continue retrospective: three columns, what each is for, step-by-step facilitation and the mistakes that ruin it. Free online board, no signup.',
			ru: 'Как провести ретроспективу Start Stop Continue: три колонки, зачем нужна каждая, пошаговый сценарий встречи и ошибки, которые её ломают. Бесплатная доска онлайн, без регистрации.'
		},
		intro: {
			en: 'Start Stop Continue is the format teams reach for first, and usually the one they keep. Each column asks for a decision rather than a feeling: what we begin doing, what we drop, what we protect. Because every card is already phrased as an action, the meeting ends with a to-do list instead of a mood.',
			ru: 'Start Stop Continue — формат, с которого команды обычно начинают и на котором чаще всего остаются. Каждая колонка требует не чувства, а решения: что начинаем делать, от чего отказываемся, что бережём. Карточка изначально формулируется как действие, поэтому встреча заканчивается списком задач, а не общим настроением.'
		},
		whenToUse: [
			{
				en: 'The team is new to retrospectives and needs a format nobody has to explain twice',
				ru: 'Команда впервые собирается на ретро и нужен формат, который не приходится объяснять дважды'
			},
			{
				en: 'Past retros produced good conversation and no changes',
				ru: 'Прошлые ретро давали хороший разговор и ноль изменений'
			},
			{
				en: 'The sprint was ordinary — no disaster to unpack, no triumph to celebrate',
				ru: 'Спринт прошёл ровно — нет ни катастрофы для разбора, ни триумфа для празднования'
			}
		],
		columns: [
			{
				title: { en: 'Start', ru: 'Начать' },
				hint: {
					en: 'Practices we do not have yet and want to try in the next sprint',
					ru: 'Практики, которых у нас пока нет и которые хотим попробовать в следующем спринте'
				}
			},
			{
				title: { en: 'Stop', ru: 'Прекратить' },
				hint: {
					en: 'Things that burn time and bring nothing back',
					ru: 'То, что съедает время и ничего не возвращает взамен'
				}
			},
			{
				title: { en: 'Continue', ru: 'Продолжить' },
				hint: {
					en: 'What worked and would quietly disappear if nobody named it',
					ru: 'То, что сработало и тихо исчезнет, если этого никто не назовёт'
				}
			}
		],
		steps: [
			{
				en: 'Open a board and share the link. Give everyone five minutes to write in silence — talking first makes the loudest opinion everyone’s opinion.',
				ru: 'Откройте доску и отправьте ссылку. Дайте всем пять минут написать молча — если начать с обсуждения, мнение самого громкого станет мнением всех.'
			},
			{
				en: 'Read the cards aloud one by one. The author clarifies, nobody argues yet.',
				ru: 'Прочитайте карточки вслух по одной. Автор поясняет, спорить пока никто не начинает.'
			},
			{
				en: 'Group duplicates. Three cards about the same slow pipeline are one problem with three votes.',
				ru: 'Сгруппируйте дубли. Три карточки про один медленный пайплайн — это одна проблема с тремя голосами.'
			},
			{
				en: 'Vote. Discuss only the top cards — a retro that touches everything changes nothing.',
				ru: 'Проголосуйте. Обсуждайте только верхние карточки — ретро, которое коснулось всего, не меняет ничего.'
			},
			{
				en: 'Turn each discussed card into an action with a name and a date attached. No owner means no change.',
				ru: 'Каждую обсуждённую карточку превратите в действие с именем ответственного и сроком. Без владельца изменения не будет.'
			}
		],
		watchOut: {
			en: 'The Stop column fills up with things outside the team’s control — other departments, company policy, the client. Those belong in a separate list you escalate, not in a retro you cannot act on.',
			ru: 'Колонка «Прекратить» набивается тем, что команде неподвластно: соседние отделы, политика компании, клиент. Такому место в отдельном списке на эскалацию, а не в ретро, по которому нельзя действовать.'
		}
	},
	{
		slug: 'mad-sad-glad',
		name: { en: 'Mad Sad Glad', ru: 'Mad Sad Glad' },
		tagline: {
			en: 'When the numbers are fine but the team is not',
			ru: 'Когда с цифрами всё хорошо, а с командой нет'
		},
		minutes: 60,
		teamSize: { en: '3–8 people', ru: '3–8 человек' },
		seoTitle: {
			en: 'Mad Sad Glad retrospective online — free board',
			ru: 'Ретроспектива Mad Sad Glad онлайн — бесплатная доска'
		},
		seoDescription: {
			en: 'How to run a Mad Sad Glad retrospective: the three emotional columns, when this format beats process-focused ones, facilitation script and safety rules. Free online board, no signup.',
			ru: 'Как провести ретроспективу Mad Sad Glad: три эмоциональные колонки, когда формат работает лучше процессных, сценарий встречи и правила безопасности. Бесплатная доска онлайн, без регистрации.'
		},
		intro: {
			en: 'Mad Sad Glad asks how the sprint felt, not how it went. That sounds soft until you notice that burnout, quiet resentment and the reason your best engineer is updating their CV never show up in a velocity chart. This format surfaces the things process retros are structurally blind to.',
			ru: 'Mad Sad Glad спрашивает не как прошёл спринт, а как он ощущался. Звучит мягко ровно до того момента, пока не замечаешь: выгорание, тихое раздражение и причина, по которой сильный инженер обновляет резюме, не появляются ни в одном графике velocity. Этот формат вытаскивает то, к чему процессные ретро слепы по своему устройству.'
		},
		whenToUse: [
			{
				en: 'Metrics look healthy and the mood does not',
				ru: 'Метрики выглядят здоровыми, а атмосфера — нет'
			},
			{
				en: 'After a crunch, a failed release or a reorg',
				ru: 'После аврала, провального релиза или реорганизации'
			},
			{
				en: 'Retros have gone quiet and polite, which usually means unsafe',
				ru: 'Ретро стали тихими и вежливыми — обычно это значит, что стало небезопасно'
			}
		],
		columns: [
			{
				title: { en: 'Mad', ru: 'Злит' },
				hint: {
					en: 'What made you angry — blockers, broken promises, repeated pain',
					ru: 'Что вызывало злость: блокеры, невыполненные обещания, повторяющаяся боль'
				}
			},
			{
				title: { en: 'Sad', ru: 'Огорчает' },
				hint: {
					en: 'Disappointments — things you hoped for that did not happen',
					ru: 'Разочарования: то, на что надеялись и что не случилось'
				}
			},
			{
				title: { en: 'Glad', ru: 'Радует' },
				hint: {
					en: 'What genuinely pleased you, however small',
					ru: 'Что искренне порадовало, пусть даже в мелочи'
				}
			}
		],
		steps: [
			{
				en: 'State the rule before anything else: we discuss situations, never people. Without it this format turns into a tribunal.',
				ru: 'Первым делом проговорите правило: обсуждаем ситуации, а не людей. Без него формат превращается в трибунал.'
			},
			{
				en: 'Write in silence, five to seven minutes. Emotions need longer than facts.',
				ru: 'Пишите молча, пять–семь минут. Эмоциям нужно больше времени, чем фактам.'
			},
			{
				en: 'Start the reading with Glad. Opening on anger sets a tone the meeting never recovers from.',
				ru: 'Начинайте чтение с «Радует». Если открыть встречу злостью, она из этого тона уже не выйдет.'
			},
			{
				en: 'For each Mad and Sad card ask once: what would have had to be different? That question converts emotion into a cause.',
				ru: 'К каждой карточке из «Злит» и «Огорчает» задайте один вопрос: что должно было быть иначе? Он переводит эмоцию в причину.'
			},
			{
				en: 'Pick two or three causes and assign owners. Leave the rest — naming a feeling out loud already did part of the work.',
				ru: 'Выберите две–три причины и назначьте ответственных. Остальное оставьте: чувство, названное вслух, уже сделало часть работы.'
			}
		],
		watchOut: {
			en: 'If the team lead runs this one, people edit themselves. Have someone else facilitate, or accept that the Mad column will be suspiciously empty.',
			ru: 'Если встречу ведёт руководитель, люди начинают себя редактировать. Отдайте фасилитацию другому человеку — или примите, что колонка «Злит» окажется подозрительно пустой.'
		}
	},
	{
		slug: '4l',
		name: { en: '4L — Liked, Learned, Lacked, Longed for', ru: '4L — Liked, Learned, Lacked, Longed for' },
		tagline: {
			en: 'Separates what you learned from what you missed',
			ru: 'Разделяет то, чему научились, и то, чего не хватило'
		},
		minutes: 60,
		teamSize: { en: '4–12 people', ru: '4–12 человек' },
		seoTitle: {
			en: '4L retrospective online — Liked, Learned, Lacked, Longed for',
			ru: 'Ретроспектива 4L онлайн — Liked, Learned, Lacked, Longed for'
		},
		seoDescription: {
			en: 'How to run a 4L retrospective: what goes in each of the four columns, why it suits long sprints and projects, step-by-step facilitation. Free online board, no signup.',
			ru: 'Как провести ретроспективу 4L: что писать в каждую из четырёх колонок, почему формат подходит длинным спринтам и проектам, пошаговый сценарий. Бесплатная доска онлайн, без регистрации.'
		},
		intro: {
			en: '4L splits the vague notion of "what went badly" into two very different things: what we lacked, and what we longed for. A missing test environment is a gap you can close this month. Wishing the product had a clearer direction is not. Keeping them in separate columns stops the team from treating both as equally fixable.',
			ru: '4L разделяет расплывчатое «что было плохо» на две совсем разные вещи: чего нам не хватило и чего мы желали. Отсутствующий тестовый стенд — пробел, который можно закрыть за месяц. Желание, чтобы у продукта была внятная стратегия, — нет. Разнесённые по колонкам, они перестают выглядеть одинаково решаемыми.'
		},
		whenToUse: [
			{
				en: 'A long sprint or a whole project phase is closing',
				ru: 'Закрывается длинный спринт или целый этап проекта'
			},
			{
				en: 'The team is learning something new — a stack, a domain, a process',
				ru: 'Команда осваивает новое: стек, предметную область, процесс'
			},
			{
				en: 'Three columns keep producing a Stop list nobody can act on',
				ru: 'Три колонки раз за разом дают список «прекратить», по которому невозможно действовать'
			}
		],
		columns: [
			{
				title: { en: 'Liked', ru: 'Понравилось' },
				hint: {
					en: 'What brought satisfaction and is worth keeping',
					ru: 'Что принесло удовлетворение и стоит сохранить'
				}
			},
			{
				title: { en: 'Learned', ru: 'Узнали' },
				hint: {
					en: 'New knowledge — technical, product or about each other',
					ru: 'Новое знание: техническое, продуктовое или друг о друге'
				}
			},
			{
				title: { en: 'Lacked', ru: 'Не хватило' },
				hint: {
					en: 'Concrete gaps: tools, access, people, information, time',
					ru: 'Конкретные пробелы: инструменты, доступы, люди, информация, время'
				}
			},
			{
				title: { en: 'Longed for', ru: 'Хотелось бы' },
				hint: {
					en: 'Wishes beyond the team’s reach — worth saying, not worth planning',
					ru: 'Желания за пределами досягаемости команды — сказать стоит, планировать нет'
				}
			}
		],
		steps: [
			{
				en: 'Say out loud how Lacked differs from Longed for. Teams mix them up on the first run and the columns become interchangeable.',
				ru: 'Проговорите вслух, чем «Не хватило» отличается от «Хотелось бы». На первом заходе команды их путают, и колонки становятся взаимозаменяемыми.'
			},
			{
				en: 'Write in silence, seven minutes — four columns need more than three.',
				ru: 'Пишите молча семь минут — четырём колонкам нужно больше времени, чем трём.'
			},
			{
				en: 'Read Learned second, right after Liked. It is the column teams skip, and it is the one that compounds.',
				ru: 'Читайте «Узнали» вторым, сразу после «Понравилось». Эту колонку обычно проскакивают, а именно она накапливается.'
			},
			{
				en: 'Vote on Lacked only. That is the column where the team actually has leverage.',
				ru: 'Голосуйте только по «Не хватило». Это единственная колонка, где у команды есть рычаг.'
			},
			{
				en: 'Take the Longed for cards to whoever can act on them — a manager, a product owner. Do not bury them in the board.',
				ru: 'Карточки из «Хотелось бы» отнесите тому, кто может по ним действовать: руководителю, продакту. Не хороните их в доске.'
			}
		],
		watchOut: {
			en: 'Four columns on a phone screen is one column at a time. If half the team joins from a phone, consider a three-column format instead.',
			ru: 'Четыре колонки на экране телефона — это одна колонка за раз. Если половина команды подключается с телефона, лучше взять формат на три колонки.'
		}
	},
	{
		slug: 'sailboat',
		name: { en: 'Sailboat', ru: 'Sailboat — Лодка' },
		tagline: {
			en: 'Looks forward, not just back',
			ru: 'Смотрит вперёд, а не только назад'
		},
		minutes: 60,
		teamSize: { en: '4–12 people', ru: '4–12 человек' },
		seoTitle: {
			en: 'Sailboat retrospective online — free board',
			ru: 'Ретроспектива Sailboat (Лодка) онлайн — бесплатная доска'
		},
		seoDescription: {
			en: 'How to run a Sailboat retrospective: wind, anchors, rocks and the island, what each metaphor is for, facilitation script. Free online board, no signup.',
			ru: 'Как провести ретроспективу Sailboat («Лодка»): ветер, якоря, рифы и остров — зачем нужна каждая метафора, сценарий встречи. Бесплатная доска онлайн, без регистрации.'
		},
		intro: {
			en: 'Sailboat is the only common format with a column for things that have not gone wrong yet. The team is a boat: wind pushes it, anchors hold it back, rocks ahead are the risks nobody has hit yet, and the island is where you are going. That risk column is why teams keep coming back to it — every other format is purely retrospective.',
			ru: 'Sailboat — единственный распространённый формат с колонкой для того, что ещё не сломалось. Команда здесь лодка: ветер её толкает, якоря тормозят, рифы впереди — риски, на которые никто пока не напоролся, а остров — то, куда вы плывёте. Именно из-за колонки рисков к формату возвращаются: все остальные смотрят исключительно назад.'
		},
		whenToUse: [
			{
				en: 'A quarter or a big release is starting and risks are worth naming early',
				ru: 'Начинается квартал или крупный релиз и риски стоит назвать заранее'
			},
			{
				en: 'The team has lost sight of where it is heading',
				ru: 'Команда потеряла из виду, куда вообще плывёт'
			},
			{
				en: 'Regular retros have become mechanical and need a shake-up',
				ru: 'Регулярные ретро стали механическими и нужно встряхнуть форму'
			}
		],
		columns: [
			{
				title: { en: 'Wind', ru: 'Ветер' },
				hint: {
					en: 'What moves us forward and should be reinforced',
					ru: 'Что двигает нас вперёд и что стоит усилить'
				}
			},
			{
				title: { en: 'Anchors', ru: 'Якоря' },
				hint: {
					en: 'What slows us down right now',
					ru: 'Что тормозит нас прямо сейчас'
				}
			},
			{
				title: { en: 'Rocks', ru: 'Рифы' },
				hint: {
					en: 'Risks ahead that have not hit us yet',
					ru: 'Риски впереди, на которые мы ещё не напоролись'
				}
			},
			{
				title: { en: 'Island', ru: 'Остров' },
				hint: {
					en: 'The goal — where we are actually trying to get',
					ru: 'Цель: куда мы на самом деле пытаемся попасть'
				}
			}
		],
		steps: [
			{
				en: 'Fill the Island first, together. If the team writes three different goals, stop the retro — you have found the real problem.',
				ru: 'Сначала заполните «Остров», вместе. Если команда напишет три разные цели — остановите ретро, настоящая проблема уже найдена.'
			},
			{
				en: 'Then wind and anchors in silence, five minutes.',
				ru: 'Затем ветер и якоря молча, пять минут.'
			},
			{
				en: 'Rocks last, and give them their own three minutes. Risks do not surface when rushed.',
				ru: 'Рифы — последними, и дайте им отдельные три минуты. Риски не всплывают в спешке.'
			},
			{
				en: 'Discuss anchors and rocks. Wind needs no discussion, only acknowledgement.',
				ru: 'Обсуждайте якоря и рифы. Ветру обсуждение не нужно, ему нужно признание.'
			},
			{
				en: 'For every rock decide one thing: do we act now, or do we watch it? Both are valid answers, silence is not.',
				ru: 'По каждому рифу решите одно: действуем сейчас или наблюдаем? Оба ответа допустимы, молчание — нет.'
			}
		],
		watchOut: {
			en: 'The metaphor can swallow the meeting — people start debating whether something is an anchor or a rock. Ten seconds of that, then move on.',
			ru: 'Метафора может съесть встречу: начинаются споры, якорь это или риф. Десять секунд на такое, дальше идём.'
		}
	}
];

export function findFormat(slug: string): RetroFormat | undefined {
	return FORMATS.find((f) => f.slug === slug);
}
