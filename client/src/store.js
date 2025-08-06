import { create } from 'zustand';

const useAppStore = create((set) => ({
	configExists: null,
	renderState: 'loading',

	setConfigExists: (value) => set({ configExists: value }),
	setRenderState: (value) => set({ renderState: value }),
}));

export default useAppStore;
