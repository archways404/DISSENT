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
		<>
			{/* Fullscreen background behind everything */}
			<div className="fixed inset-0 bg-gray-800 z-0" />

			<Dialog open={true}>
				<DialogContent
					className="max-w-md w-full py-18 px-8 rounded-lg shadow-lg border border-border"
					style={{ backgroundColor: 'oklch(25.197% 0.00003 271.152)' }}
					showCloseButton={false}>
					<DialogHeader className="w-full text-center">
						<div className="flex justify-center mb-6">
							<Lock
								size={50}
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
						{/* Fixed-height container for error */}
						<div className="h-5 mt-2">
							{error ? (
								<HoverCard>
									<HoverCardTrigger asChild>
										<p className="text-red-500 text-sm text-center cursor-help">Unlock failed</p>
									</HoverCardTrigger>
									<HoverCardContent className="max-w-xs break-words">
										<p>{error}</p>
									</HoverCardContent>
								</HoverCard>
							) : null}
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
