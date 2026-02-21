import dgram from 'node:dgram';

const statsd = dgram.createSocket('udp4');
const STATSD_HOST = process.env.STATSD_HOST || 'localhost';
const STATSD_PORT = parseInt(process.env.STATSD_PORT || '8125');

export function metric(name: string, value: number, type = 'c') {
	const msg = Buffer.from(`${name}:${value}|${type}`);
	statsd.send(msg, STATSD_PORT, STATSD_HOST);
}
