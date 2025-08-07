import { useEffect } from 'react';
import useAppStore from '../store';

export default function useConfigLockListener() {
	const setUnlocked = useAppStore((state) => state.setConfigUnlocked);
	const setRenderState = useAppStore((state) => state.setRenderState);

	useEffect(() => {
		const handler = () => {
			setUnlocked(false);
			setRenderState('unlock');
		};

		// Register listener
		window.electronAPI.onConfigLocked(handler);

		// Cleanup
		return () => {
			window.electronAPI?.removeConfigLocked?.(handler);
		};
	}, []);
}
