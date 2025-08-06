import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Lock } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

import useAppStore from '../store';

export default function Unlock() {
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
		<Dialog open={true}>
			<DialogContent
				className="max-w-md w-full bg-background py-12 px-8 rounded-lg shadow-lg border border-border backdrop-blur-md"
				showCloseButton={false}>
				<DialogHeader className="w-full text-center">
					<div className="flex justify-center mb-6">
						<Lock
							size={40}
							className="text-primary"
						/>
					</div>
				</DialogHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleUnlock();
					}}
					className="flex flex-col items-center gap-4">
					<Input
						type="password"
						placeholder="Enter passphrase"
						value={pass}
						onChange={(e) => setPass(e.target.value)}
						className="w-1/2 text-left text-base p-3 rounded-md border border-input focus:ring-2 focus:ring-primary"
						autoFocus
					/>
					{error && (
						<HoverCard>
							<HoverCardTrigger asChild>
								<p className="text-red-500 text-sm text-center cursor-help">Unlock failed</p>
							</HoverCardTrigger>
							<HoverCardContent className="max-w-xs break-words">
								<p>{error}</p>
							</HoverCardContent>
						</HoverCard>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}
