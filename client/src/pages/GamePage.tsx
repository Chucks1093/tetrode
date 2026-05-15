import { Link, useParams } from 'react-router';

const GAME_TITLES: Record<string, string> = {
	'the-hidden-human': 'The Hidden Human',
	'hunt-the-ai': 'Hunt The AI',
	'mind-match': 'Mind Match',
	mindflip: 'MindFlip',
};

export default function GamePage() {
	const { gameId = '' } = useParams();
	const title = GAME_TITLES[gameId];

	if (!title) {
		return (
			<div className="min-h-screen bg-black text-odin-light-100 flex items-center justify-center px-6">
				<div className="text-center">
					<p className="font-ps2p text-lg text-orange-500">Game Not Found</p>
					<Link
						to="/"
						className="mt-6 inline-flex rounded-lg bg-orange-700 px-5 py-2.5 font-jakarta font-semibold text-white hover:bg-orange-600"
					>
						Back Home
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-black text-odin-light-100 flex items-center justify-center px-6">
			<div className="text-center">
				<p className="font-ps2p text-orange-500 text-lg sm:text-2xl">{title}</p>
				<p className="mt-4 font-manrope text-odin-light-500">Game room and flow coming soon.</p>
				<Link
					to="/"
					className="mt-6 inline-flex rounded-lg bg-orange-700 px-5 py-2.5 font-jakarta font-semibold text-white hover:bg-orange-600"
				>
					Back Home
				</Link>
			</div>
		</div>
	);
}
