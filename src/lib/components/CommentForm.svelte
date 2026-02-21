<script lang="ts">
	import { socketStore } from '$lib/stores/socket.svelte.js';
	import { t } from '$lib/i18n/index.js';

	let { cardId }: { cardId: string } = $props();

	let content = $state('');

	function submit() {
		const text = content.trim();
		if (!text) return;
		socketStore.createComment(cardId, text);
		content = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="flex gap-2">
	<input
		type="text"
		bind:value={content}
		onkeydown={handleKeydown}
		placeholder={t('comment.placeholder')}
		class="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none"
	/>
	<button
		type="submit"
		disabled={!content.trim()}
		class="rounded-md bg-text-primary px-2.5 py-1.5 text-xs font-medium text-surface transition-opacity disabled:opacity-30"
	>
		{t('comment.send')}
	</button>
</form>
