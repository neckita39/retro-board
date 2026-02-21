let statsd: import('dgram').Socket | null = null;
const STATSD_HOST = process.env.STATSD_HOST || 'localhost';
const STATSD_PORT = parseInt(process.env.STATSD_PORT || '8125');

try {
	const dgram = await import('node:dgram');
	statsd = dgram.createSocket('udp4');
	statsd.unref();
} catch {
	// dgram unavailable — metrics silently disabled
}

export function metric(name: string, value: number, type = 'c') {
	if (!statsd) return;
	const msg = Buffer.from(`${name}:${value}|${type}`);
	statsd.send(msg, STATSD_PORT, STATSD_HOST);
}
