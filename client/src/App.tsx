import './App.css';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Fragment } from 'react/jsx-runtime';
import { Toaster } from 'react-hot-toast';

import LandingPage from './pages/LandingPage';
import GameCore from './pages/games/GameCore';
import GameDetails from './pages/games/GameDetails';

import GlobalErrorPage from './pages/GlobalErrorPage';

const router = createBrowserRouter([
	{
		path: '/',
		errorElement: <GlobalErrorPage />,
		children: [
			{
				index: true,
				element: <LandingPage />,
			},
			{
				path: ':gameId',
				element: <GameDetails />,
			},
			{
				path: ':gameId/:roomId',
				element: <GameCore />,
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
