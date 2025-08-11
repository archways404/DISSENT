import useApplicationState from './applicationState';

function applicationRenderer() {
	const { renderState, setRenderState, setConfigExists, setConfigUnlocked } = useApplicationState();

	// Boot-time logic here
	useEffect(() => {
		if (renderState !== 'loading') return;

		const runChecks = async () => {
			// Example boot checks
			const configExists = await checkIfConfigExists();
			setConfigExists(configExists);

			if (!configExists) {
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

	switch (renderState) {
		case 'loading':
			return <LoadingScreen />;
		case 'setup':
			return <SetupScreen />;
		case 'home':
			return <HomeScreen />;
		case 'locked':
			return <LockedScreen />;
		default:
			return <p>Unknown render state: {renderState}</p>;
	}
}

export default applicationRenderer;
