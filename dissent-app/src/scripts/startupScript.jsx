import { useEffect } from 'react';
import useApplicationState from '@/applicationState';

export default function startupCheck() {
	const { renderState, configExists, setRenderState, setConfigExists, setConfigUnlocked } =
		useApplicationState();

	// Initial boot-time checks
	useEffect(() => {
		if (renderState !== 'loading') return;

		const runChecks = async () => {
			const exists = await checkIfConfigExists();
			setConfigExists(exists);

			if (!exists) {
				setRenderState('setup');
				return;
			}

			const unlocked = await checkIfUnlocked();
			setConfigUnlocked(unlocked);

			if (unlocked) {
				setRenderState('home');
			} else {
				setRenderState('locked');
			}
		};

		runChecks();
	}, [renderState]);

	// Polling config file if it exists
	useEffect(() => {
		if (!configExists) return;

		const interval = setInterval(async () => {
			const stillExists = await checkIfConfigExists();

			if (!stillExists) {
				// config was deleted somehow
				setConfigExists(false);
				setRenderState('setup');
			}
		}, 1000); // poll every second

		return () => clearInterval(interval);
	}, [configExists]);
}
