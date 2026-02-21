import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { boards } from '$lib/server/db/schema.js';
import { nanoid } from 'nanoid';
import dgram from 'dgram';
import type { Actions } from './$types.js';

const statsd = dgram.createSocket('udp4');
const STATSD_HOST = process.env.STATSD_HOST || 'localhost';
const STATSD_PORT = parseInt(process.env.STATSD_PORT || '8125');

function metric(name: string, value: number, type = 'c') {
	const msg = Buffer.from(`${name}:${value}|${type}`);
	statsd.send(msg, STATSD_PORT, STATSD_HOST);
}

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const title = formData.get('title') as string;

		if (!title?.trim()) {
			return { error: 'Title is required' };
		}

		const slug = nanoid(21);

		await db.insert(boards).values({
			title: title.trim(),
			slug
		});

		metric('retro.board.created', 1);

		throw redirect(303, `/${slug}`);
	}
};
