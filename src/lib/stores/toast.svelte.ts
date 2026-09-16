// Уведомления в правом верхнем углу. Живут в layout, поэтому переживают
// переходы между страницами: «AI-анализ готов» догонит, куда бы ни ушёл человек.
export type ToastKind = 'info' | 'success' | 'error';

// Действие — ссылка (href) или кнопка (onClick), хотя бы одно из двух.
// После onClick подпись на 2 секунды сменяется на «Скопировано!» (см. Toasts.svelte).
export type ToastAction =
	| { label: string; href: string; onClick?: () => void | Promise<void> }
	| { label: string; href?: string; onClick: () => void | Promise<void> };

export interface ToastInput {
	kind: ToastKind;
	text: string;
	action?: ToastAction;
	timeoutMs?: number;
}

export interface Toast extends ToastInput {
	id: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const ERROR_TIMEOUT_MS = 12_000;

class ToastStore {
	toasts = $state<Toast[]>([]);
	private nextId = 1;
	private timers = new Map<number, ReturnType<typeof setTimeout>>();

	push(input: ToastInput): number {
		const id = this.nextId++;
		this.toasts = [...this.toasts, { ...input, id }];
		const timeout = input.timeoutMs ?? (input.kind === 'error' ? ERROR_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
		this.timers.set(id, setTimeout(() => this.dismiss(id), timeout));
		return id;
	}

	dismiss(id: number) {
		const timer = this.timers.get(id);
		if (timer) clearTimeout(timer);
		this.timers.delete(id);
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	clear() {
		for (const id of [...this.timers.keys()]) this.dismiss(id);
		this.toasts = [];
	}
}

export const toastStore = new ToastStore();
