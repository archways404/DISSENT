import { useEffect } from 'react';
import useAppStore from '../store';

function ConfigCheck() {
	const { setConfigExists, setRenderState } = useAppStore();

	useEffect(() => {
		async function check() {
			const exists = await window.electronAPI.checkConfig();
			setConfigExists(exists);
			setRenderState(exists ? 'unlock' : 'setup'); // ask for passphrase if file exists
		}
		check();
	}, [setConfigExists, setRenderState]);

	return <p>Checking config...</p>;
}

export default ConfigCheck;
