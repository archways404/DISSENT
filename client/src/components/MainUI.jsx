import { useEffect } from 'react';
import useAppStore from '../store';

function MainUI() {
	const renderState = useAppStore((state) => state.renderState);

	useEffect(() => {
		async function runTest() {
			try {
				// Encrypt
				const encrypted = await window.electronAPI.cryptoOp('ENCRYPT', 'hello');
				console.log('Encrypted (raw buffer or bytes):', encrypted);

				// Decrypt
				const decrypted = await window.electronAPI.cryptoOp('DECRYPT', encrypted);
				console.log('Decrypted:', decrypted);
			} catch (err) {
				console.error('Crypto test failed:', err);
			}
		}

		runTest();
	}, []);

	return (
		<div>
			<h2>Main Application</h2>
			<p>Render state: {renderState}</p>
		</div>
	);
}

export default MainUI;
