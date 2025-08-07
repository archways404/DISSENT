import { useEffect } from 'react';
import useAppStore from '../store';

export default function useConfigLockPoller(interval = 2000) {
	const setUnlocked = useAppStore((state) => state.setConfigUnlocked);

	useEffect(() => {
		let poller;

		const checkLockStatus = async () => {
			try {
				const status = await window.electronAPI.configLockStatus();
				setUnlocked(status);
			} catch (err) {
				console.error('Failed to poll config lock status:', err);
			}
		};

		checkLockStatus();
		poller = setInterval(checkLockStatus, interval);

		return () => clearInterval(poller);
	}, [interval, setUnlocked]);
}
