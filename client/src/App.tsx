import './App.css';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Fragment } from 'react/jsx-runtime';
import { Toaster } from 'react-hot-toast';

import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import AuthRoute from './pages/auth/AuthRoute';
import OAuthCallback from './pages/auth/OAuthCallback';
import GameCore from './pages/games/GameCore';
import GameDetails from './pages/games/GameDetails';

import GlobalErrorPage from './pages/GlobalErrorPage';
import { requireAuthLoader } from './loaders/auth.loader';

const router = createBrowserRouter([
	{
		path: '/',
		element: <LandingPage />,
		errorElement: <GlobalErrorPage />,
		children: [
			{
				path: 'auth/:mode',
				element: <AuthRoute />,
			},
			{
				path: '*',
				element: (
					<GlobalErrorPage
						title="Page not found"
						description="The page you are looking for does not exist."
						showErrorDetails={false}
					/>
				),
			},
		],
	},
	{
		path: '/about',
		element: <AboutPage />,
		errorElement: <GlobalErrorPage />,
	},
	{
		path: '/auth/callback',
		element: <OAuthCallback />,
		errorElement: <GlobalErrorPage />,
	},
	{
		path: '/games/:gameId',
		element: <GameDetails />,
		loader: requireAuthLoader,
		errorElement: <GlobalErrorPage />,
	},
	{
		path: '/games/:gameId/:roomId',
		element: <GameCore />,
		loader: requireAuthLoader,
		errorElement: <GlobalErrorPage />,
	},
]);

function App() {
	return (
		<Fragment>
			<Toaster />
			<RouterProvider router={router} />
		</Fragment>
	);
}

export default App;
