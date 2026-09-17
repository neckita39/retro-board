<script lang="ts">
	import type { CardTask } from '$lib/types.js';
	import { t } from '$lib/i18n/index.js';

	// Бейдж-ссылка на задачу Битрикс24 (заметки макета 12–14, 29). Нейтральный:
	// не цвет колонки, не терракота и не improve.
	// md — 32px на карточке и в обсуждаемой строке Итогов (40 на телефоне);
	// sm — 28px «#123» в обычной строке Итогов.
	let { task, size = 'md' }: { task: CardTask; size?: 'md' | 'sm' } = $props();
</script>

{#if size === 'sm'}
	<!-- pointer-events-auto: иначе во время обсуждения клик уйдёт в прозрачный слой прыжка фокуса -->
	<a
		href={task.url}
		target="_blank"
		rel="noopener"
		data-testid="task-badge"
		title={t('bitrix.card.taskTitle', { id: task.id })}
		aria-label={t('bitrix.card.taskTitle', { id: task.id })}
		class="badge-pop pointer-events-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-[13px] font-semibold tabular-nums text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
	>
		<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></svg>
		#{task.id}
	</a>
{:else}
	<a
		href={task.url}
		target="_blank"
		rel="noopener"
		data-testid="task-badge"
		title={task.url}
		class="badge-pop pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-card px-3 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-surface-hover active:scale-[0.97] max-md:h-10 max-md:px-4"
	>
		{t('bitrix.card.task', { id: task.id })}
		<svg class="h-3.5 w-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
	</a>
{/if}
