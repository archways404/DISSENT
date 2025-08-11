import { create } from 'zustand';

const useApplicationState = create((set) => ({
	configExists: null,
	renderState: 'loading',
	isConfigUnlocked: false,

	setConfigExists: (value) => set({ configExists: value }),
	setRenderState: (value) => set({ renderState: value }),
	setConfigUnlocked: (value) => set({ isConfigUnlocked: value }),
}));

export default useApplicationState;
