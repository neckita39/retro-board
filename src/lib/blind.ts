// Типизированный вход в blind.js (корень репо) — см. комментарий там.
import {
	viewCard as view,
	viewCards as viewAll,
	isHidden as hiddenFlag,
	visibleComments as visible
} from '../../blind.js';

/** Всё, что нужно маскировщику от карточки: чья она */
export interface HasAuthorSession {
	authorSession?: string | null;
}

/** Карточка глазами зрителя: те же поля плюс признак рубашки */
export type Viewed<T> = T & { hidden?: true };

export const viewCard = view as <T extends HasAuthorSession>(
	card: T,
	blind: boolean,
	viewerSession: string
) => Viewed<T>;

export const viewCards = viewAll as <T extends HasAuthorSession>(
	cards: T[],
	blind: boolean,
	viewerSession: string
) => Viewed<T>[];

export const isHidden = hiddenFlag as (card: { hidden?: boolean }) => boolean;

export const visibleComments = visible as <T extends { cardId: string }>(
	comments: T[],
	cards: { id: string; hidden?: boolean }[]
) => T[];
