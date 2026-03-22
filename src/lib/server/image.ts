import sharp from 'sharp';

const MAGIC_BYTES: Array<{ bytes: number[]; mime: string }> = [
	{ bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
	{ bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
	{ bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
];

export function validateMimeType(buffer: Buffer): string | null {
	// WebP: RIFF....WEBP
	if (
		buffer.length >= 12 &&
		buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
		buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
	) {
		return 'image/webp';
	}

	for (const { bytes, mime } of MAGIC_BYTES) {
		if (buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b)) {
			return mime;
		}
	}

	return null;
}

export async function compressImage(buffer: Buffer): Promise<{ data: Buffer; mimeType: string; width: number; height: number }> {
	const detectedMime = validateMimeType(buffer);

	// Animated GIF stays GIF (just resize)
	if (detectedMime === 'image/gif') {
		const result = await sharp(buffer, { animated: true })
			.resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
			.gif()
			.toBuffer({ resolveWithObject: true });
		return {
			data: result.data,
			mimeType: 'image/gif',
			width: result.info.width,
			height: result.info.height
		};
	}

	// Everything else → WebP
	const result = await sharp(buffer)
		.resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer({ resolveWithObject: true });

	return {
		data: result.data,
		mimeType: 'image/webp',
		width: result.info.width,
		height: result.info.height
	};
}
