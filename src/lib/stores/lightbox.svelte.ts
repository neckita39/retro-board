class LightboxStore {
	imageId = $state<string | null>(null);

	open(id: string) {
		this.imageId = id;
	}

	close() {
		this.imageId = null;
	}
}

export const lightboxStore = new LightboxStore();
