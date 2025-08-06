import { useState } from 'react';
import useAppStore from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';

function Setup() {
	const setConfigExists = useAppStore((state) => state.setConfigExists);
	const setRenderState = useAppStore((state) => state.setRenderState);

	const [passphrase, setPassphrase] = useState('');
	const [showCreateForm, setShowCreateForm] = useState(false);

	async function handleImport() {
		const success = await window.electronAPI.importConfig();
		if (success) {
			setConfigExists(true);
			setRenderState('main');
		}
	}

	async function handleCreate() {
		if (!passphrase.trim()) return;
		if (passphrase.length < 4) {
			alert('Passphrase must be at least 4 characters.');
			return;
		}

		const success = await window.electronAPI.createConfigWithPass(passphrase);
		if (success) {
			setConfigExists(true);
			setRenderState('main');
			setShowCreateForm(false);
		}
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground px-4">
			<h1 className="text-3xl font-bold mb-2">ProtectU84</h1>
			<p className="text-muted-foreground mb-6 text-center max-w-md">
				No config file found. You can import an existing <code>config.enc</code> file or create a
				new one.
			</p>

			<div className="flex gap-4">
				<Button
					onClick={handleImport}
					variant="secondary">
					Import Config
				</Button>
				<Button
					onClick={() => setShowCreateForm(true)}
					variant="default">
					Create New Config
				</Button>
			</div>

			<Dialog
				open={showCreateForm}
				onOpenChange={setShowCreateForm}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Create New Config</DialogTitle>
						<DialogDescription>
							Enter a secure passphrase to encrypt your new config file.
						</DialogDescription>
					</DialogHeader>
					<Input
						type="password"
						placeholder="Enter secret passphrase"
						value={passphrase}
						onChange={(e) => setPassphrase(e.target.value)}
					/>
					<DialogFooter>
						<Button
							variant="secondary"
							onClick={() => setShowCreateForm(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreate}>Save Config</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default Setup;
