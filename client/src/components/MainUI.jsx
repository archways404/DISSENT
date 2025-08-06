import useAppStore from '../store';

function MainUI() {
	const renderState = useAppStore((state) => state.renderState);

	return (
		<div>
			<h2>Main Application</h2>
			<p>Render state: {renderState}</p>
		</div>
	);
}

export default MainUI;
