-- Слепой ввод: пока он включён на доске, карточку видит только её автор,
-- остальные — рубашку. Снимает якорение: первый написал «релизы», и дальше
-- все пишут про релизы.
--
-- author_session — тот же идентификатор браузера, что у голосов
-- (localStorage retro-session-id). Он нужен ровно для одного: показать
-- человеку его собственные карточки. Наружу не отдаётся никогда, иначе по
-- нему можно было бы сгруппировать карточки по авторам и снять анонимность.
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "blind" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "author_session" text;
