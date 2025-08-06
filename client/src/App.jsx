import useAppStore from './store';
import ConfigCheck from './components/ConfigCheck';
import Setup from './components/Setup';
import MainUI from './components/MainUI';
import Unlock from './components/Unlock';

function App() {
	const { renderState } = useAppStore();

	switch (renderState) {
		case 'loading':
			return <ConfigCheck />;
		case 'setup':
			return <Setup />;
		case 'main':
			return <MainUI />;
		case 'unlock':
			return <Unlock />;
		default:
			return <p>Unknown render state: {renderState}</p>;
	}
}

export default App;
