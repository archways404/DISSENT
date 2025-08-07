import { useEffect } from 'react';
import useAppStore from '../store';

export default function useAutoLockActivity() {
	const isUnlocked = useAppStore((state) => state.isConfigUnlocked);

	useEffect(() => {
		let timeout;

		const refresh = () => {
			if (!isUnlocked) return;

			clearTimeout(timeout);
			timeout = setTimeout(() => {
				window.electronAPI.refreshAutoLock();
			}, 200); // Debounce to avoid spam
		};

		const handleActivity = () => refresh();

		window.addEventListener('mousemove', handleActivity);
		window.addEventListener('keydown', handleActivity);
		window.addEventListener('mousedown', handleActivity);
		window.addEventListener('touchstart', handleActivity);

		// kickstart
		refresh();

		return () => {
			clearTimeout(timeout);
			window.removeEventListener('mousemove', handleActivity);
			window.removeEventListener('keydown', handleActivity);
			window.removeEventListener('mousedown', handleActivity);
			window.removeEventListener('touchstart', handleActivity);
		};
	}, [isUnlocked]);
}
