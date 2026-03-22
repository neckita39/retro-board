import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index.js';
import { images } from '$lib/server/db/schema.js';
import { validateMimeType, compressImage } from '$lib/server/image.js';

const MAX_RAW_SIZE = 20 * 1024 * 1024; // 20MB

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('image');

	if (!file || !(file instanceof File)) {
		throw error(400, 'No image provided');
	}

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	if (buffer.length > MAX_RAW_SIZE) {
		throw error(400, 'File too large (max 20MB)');
	}

	const mime = validateMimeType(buffer);
	if (!mime) {
		throw error(400, 'Invalid image format');
	}

	const compressed = await compressImage(buffer);

	const [image] = await db
		.insert(images)
		.values({
			data: compressed.data,
			mimeType: compressed.mimeType,
			width: compressed.width,
			height: compressed.height
		})
		.returning({ id: images.id, width: images.width, height: images.height });

	return json({ imageId: image.id, width: image.width, height: image.height });
};
