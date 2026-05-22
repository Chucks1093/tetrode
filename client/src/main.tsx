import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import PrivyAuthProvider from './components/providers/PrivyAuthProvider.tsx';

document.documentElement.classList.add('dark');

const isMarketing = import.meta.env.VITE_APP_MODE === 'marketing';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		{isMarketing ? (
			<App />
		) : (
			<PrivyAuthProvider>
				<App />
			</PrivyAuthProvider>
		)}
	</StrictMode>
);
