import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

const root = ReactDOM.createRoot(
	document.querySelector('#root') as HTMLDivElement
);

root.render(<App />);
