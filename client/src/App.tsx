import './App.css';
import { createBrowserRouter, redirect, RouterProvider } from 'react-router';
import { Fragment } from 'react/jsx-runtime';
import { Toaster } from 'react-hot-toast';

import LandingPage from './pages/LandingPage';
import GamePage from './pages/GamePage';
import StoriesPage from './pages/story/StoriesPage';
import StoryDetailsPage from './pages/story/StoryDetailsPage';
import BookmarksPage from './pages/story/BookmarksPage';
import HowItWorksPage from './pages/auth/HowItWorksPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import OAuthCallback from './pages/auth/OAuthCallback';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import CreatePassword from './pages/auth/CreatePassword';
import GlobalErrorPage from './pages/GlobalErrorPage';
import { storiesAuthLoader } from './loaders/profile.loader';

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
				element: <GamePage />,
			},
			{
				path: 'stories',
				element: <StoriesPage />,
				loader: storiesAuthLoader,
			},
			{
				path: 'stories/:storyId',
				element: <StoryDetailsPage />,
				loader: storiesAuthLoader,
			},
			{
				path: 'bookmarks',
				element: <BookmarksPage />,
				loader: storiesAuthLoader,
			},
			{
				path: 'about',
				element: <HowItWorksPage />,
			},
			{
				path: 'how-it-works',
				loader: () => redirect('/about'),
			},
			{
				path: 'auth',
				loader: () => redirect('/auth/login'),
			},
			{
				path: 'auth/login',
				element: <Login />,
			},
			{
				path: 'auth/register',
				element: <Register />,
			},
			{
				path: 'auth/google/callback',
				element: <OAuthCallback />,
			},
			{
				path: 'auth/verify',
				element: <VerifyEmail />,
			},
			{
				path: 'auth/password/forgot',
				element: <ForgotPassword />,
			},
			{
				path: 'auth/password/create',
				element: <CreatePassword />,
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
