import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './components/ui/button';

function App() {
	const [greetMsg, setGreetMsg] = useState('');
	const [name, setName] = useState('');

	async function greet() {
		// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
		setGreetMsg(await invoke('greet', { name }));
	}

	async function createConfig() {
		try {
			const result = await invoke('create_config_file');
			console.log(result);
		} catch (error) {
			console.error('Error creating config file:', error);
		}
	}

	async function checkConfigFile() {
		try {
			const result = await invoke('config_file_exists');
			console.log(result);
			await invoke('load_config_into_memory');
		} catch (error) {
			console.error('Error checking config file:', error);
		}
	}

	async function getConfig() {
		try {
			const config = await invoke('get_loaded_config');
			console.log('Loaded config:', config);
		} catch (err) {
			console.error('Failed to load config:', err);
		}
	}

	return (
		<main className="container">
			<form
				className="row"
				onSubmit={(e) => {
					e.preventDefault();
					greet();
				}}>
				<input
					id="greet-input"
					onChange={(e) => setName(e.currentTarget.value)}
					placeholder="Enter a name..."
				/>
				<button type="submit">Greet</button>
			</form>
			<p>{greetMsg}</p>
			<Button onClick={createConfig}>createconfig</Button>
			<Button onClick={checkConfigFile}>checkconfig</Button>
			<Button onClick={getConfig}>getConfig</Button>
		</main>
	);
}

export default App;
