<script lang="ts">
	import { SITE } from '$lib/seo.js';
	import { t } from '$lib/i18n/index.js';

	// Один набор метатегов на все публичные страницы — до этого og/twitter
	// были расписаны только на главной и разъехались бы при копировании.
	let {
		title,
		description,
		path = '/'
	}: {
		title: string;
		description: string;
		path?: string;
	} = $props();

	let url = $derived(`${SITE}${path}`);
	let image = `${SITE}/og.png`;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />

	<meta property="og:type" content="website" />
	<meta property="og:url" content={url} />
	<meta property="og:site_name" content={t('header.brand')} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>
