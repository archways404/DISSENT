import { useEffect, useState } from 'react';
import useAppStore from '../store';

function MainUI() {
	const [decryptedConfigContents, setDecryptedConfigContents] = useState(null);
	const renderState = useAppStore((state) => state.renderState);

	useEffect(() => {
		async function runTest() {
			try {
				const decryptedConfig = await window.electronAPI.getDecryptedConfig();
				console.log('decryptedConfig', decryptedConfig);
				setDecryptedConfigContents(decryptedConfig); // keep as object
			} catch (err) {
				console.error('Crypto test failed:', err);
			}
		}

		runTest();
	}, []);

	return (
		<div className="p-4">
			<h2 className="text-xl font-semibold mb-2">Main Application</h2>
			<p className="mb-4 text-gray-700">Render state: {renderState}</p>

			<h3 className="font-medium mb-2">CONFIG:</h3>

			<pre className="text-green-400 text-sm p-4 rounded overflow-auto max-h-[400px] whitespace-pre-wrap">
				{decryptedConfigContents
					? JSON.stringify(decryptedConfigContents, null, 2)
					: 'No config loaded'}
			</pre>
		</div>
	);
}

export default MainUI;
