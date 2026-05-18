import './App.css';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Fragment } from 'react/jsx-runtime';
import { Toaster } from 'react-hot-toast';

import LandingPage from './pages/LandingPage';
import AuthRoute from './pages/auth/AuthRoute';
import OAuthCallback from './pages/auth/OAuthCallback';
import GameCore from './pages/games/GameCore';
import GameDetails from './pages/games/GameDetails';

import GlobalErrorPage from './pages/GlobalErrorPage';

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
		path: '/auth/callback',
		element: <OAuthCallback />,
		errorElement: <GlobalErrorPage />,
	},
	{
		path: '/:gameId',
		element: <GameDetails />,
		errorElement: <GlobalErrorPage />,
	},
	{
		path: '/:gameId/:roomId',
		element: <GameCore />,
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
