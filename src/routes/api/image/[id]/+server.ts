import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const [image] = await db
		.select({ data: images.data, mimeType: images.mimeType })
		.from(images)
		.where(eq(images.id, params.id))
		.limit(1);

	if (!image) {
		throw error(404, 'Image not found');
	}

	// Node's Buffer type doesn't satisfy BodyInit — copy into a plain-ArrayBuffer view.
	// Only dev hits this route; production serves images via raw HTTP in server.js.
	return new Response(new Uint8Array(image.data), {
		headers: {
			'Content-Type': image.mimeType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
