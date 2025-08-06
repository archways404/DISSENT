import { useState } from 'react';
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
import useAppStore from '../store';

function Unlock() {
	const setRenderState = useAppStore((state) => state.setRenderState);
	const [pass, setPass] = useState('');
	const [error, setError] = useState('');

	async function handleUnlock() {
		try {
			setError('');
			const decrypted = await window.electronAPI.unlockConfig(pass);
			console.log('Decrypted config:', decrypted);
			setPass('');
			setRenderState('main');
		} catch (err) {
			console.error('Unlock failed:', err);
			setError(err.toString());
		}
	}

	return (
		<div>
			<Dialog open={true}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>LOCKED</DialogTitle>
						<DialogDescription>Enter your passphrase to unlock.</DialogDescription>
					</DialogHeader>
					<Input
						type="password"
						placeholder="Enter passphrase"
						value={pass}
						onChange={(e) => setPass(e.target.value)}
					/>
					<DialogFooter>
						<Button onClick={handleUnlock}>Unlock</Button>
						{error && <p className="text-red-500">{error}</p>}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default Unlock;
