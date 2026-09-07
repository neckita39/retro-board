<script lang="ts">
	let { data }: { data: Record<string, unknown> } = $props();

	// Тег собирается по кускам намеренно: цельная последовательность из '<' и
	// слова script — хоть в разметке, хоть в комментарии — обрывает блок скрипта
	// прямо на этом месте, и файл перестаёт компилироваться. Заодно экранируем
	// '<' в данных, иначе закрывающий тег внутри текста оборвал бы разметку.
	const OPEN = '<' + 'script type="application/ld+json">';
	const CLOSE = '<' + '/' + 'script>';

	let tag = $derived(OPEN + JSON.stringify(data).replace(/</g, '\\u003c') + CLOSE);
</script>

<svelte:head>
	{@html tag}
</svelte:head>
