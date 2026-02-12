<script lang="ts">
	import Header from '$lib/components/Header.svelte';
</script>

<svelte:head>
	<title>Retro Board — Create a Board</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="flex flex-1 items-center justify-center p-4">
		<div class="w-full max-w-md space-y-8 text-center">
			<div class="space-y-2">
				<h1 class="text-3xl font-bold tracking-tight text-text-primary">
					Start a Retrospective
				</h1>
				<p class="text-text-secondary">
					Create a board and share the link with your team.
				</p>
			</div>

			<form method="POST" class="space-y-4">
				<input
					type="text"
					name="title"
					placeholder="Board title, e.g. Sprint 42 Retro"
					required
					class="w-full rounded-xl border border-border bg-surface-card px-4 py-3 text-text-primary placeholder:text-text-muted transition-colors focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-border"
				/>
				<button
					type="submit"
					class="w-full rounded-xl bg-text-primary px-4 py-3 font-medium text-surface transition-opacity hover:opacity-90"
				>
					Create Board
				</button>
			</form>

			<p class="text-xs text-text-muted">
				No signup required. Anyone with the link can participate.
			</p>
		</div>
	</main>
</div>
