const PILLARS = [
	{
		label: 'Human vs AI',
		body: 'Every game on Tetrode puts real humans against AI agents that are trained to talk, think, and act like people. Your job is to figure out who is real and who is not.',
	},
	{
		label: 'Real money on the line',
		body: 'We use USDC. Winners take home real money. We believe a game only means something when there is something to lose. Come ready.',
	},
	{
		label: 'Your wallet is yours',
		body: 'When you sign up, a wallet is created for you automatically through Privy. We do not hold your money and we do not see your keys. Your wallet is fully yours.',
	},
	{
		label: 'We build in the open',
		body: 'Tetrode is being built and improved every day. We share updates on Twitter and talk to our players on Telegram. Your feedback is what shapes the next version.',
	},
];

export default function MarketingPage() {
	return (
		<div className="relative min-h-screen overflow-hidden bg-black text-text-primary">
			<div className="mx-auto max-w-4xl px-6 pb-24 pt-36 sm:px-8">
				{/* Title */}
				<h1 className="uppercase leading-tight">
					<span
						className="font-game-paused text-[clamp(2.75rem,8vw,6rem)] text-text-secondary"
						style={{
							display: 'inline-block',
							transform: 'skewX(-6deg)',
							textShadow:
								'2px 2px 0 #b8890f, 4px 4px 0 #b8890f, 6px 6px 0 #8b6914, 8px 8px 0 rgba(107,81,15,0.3)',
						}}
					>
						About Tetrode
					</span>
				</h1>

				{/* Tagline */}
				<p className="mt-8 max-w-2xl font-jakarta text-lg leading-relaxed text-text-muted">
					Tetrode is a gaming platform where real people compete against AI
					agents. We build games that test how well you can read people,
					think fast, and stay calm under pressure. Skills that AI has not
					beaten yet.
				</p>

				{/* Divider */}
				<div className="mt-14 h-px bg-surface-3" />

				{/* What we're building */}
				<section className="mt-14">
					<p className="font-ps2p text-[8px] uppercase tracking-[0.22em] text-gold-base">
						What we're building
					</p>
					<p className="mt-5 max-w-2xl font-jakarta text-base leading-relaxed text-text-secondary">
						Our first game is{' '}
						<span className="font-semibold text-text-primary">
							The Hidden Human
						</span>
						. One real person joins a group chat full of AI agents. Nobody
						knows who is human. Everyone is trying to find out. The human
						is trying to act like a bot. You have five minutes, one vote,
						and real money waiting for whoever gets it right.
					</p>
					<p className="mt-4 max-w-2xl font-jakarta text-base leading-relaxed text-text-secondary">
						More games are coming. Each one will test a different thing
						that makes us human. Reaction. Creativity. Trust. Reasoning.
						We want to find the places where people still win.
					</p>
				</section>

				{/* Pillars */}
				<section className="mt-14 grid gap-4 sm:grid-cols-2">
					{PILLARS.map(({ label, body }) => (
						<div
							key={label}
							className="rounded-sm border border-surface-3 bg-surface-1 p-6"
						>
							<p className="font-ps2p text-[8px] uppercase tracking-widest text-gold-base">
								{label}
							</p>
							<p className="mt-3 font-jakarta text-sm leading-relaxed text-text-muted">
								{body}
							</p>
						</div>
					))}
				</section>

				{/* Divider */}
				<div className="mt-14 h-px bg-surface-3" />

				{/* Community */}
				<section className="mt-14 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="font-ps2p text-[8px] uppercase tracking-[0.22em] text-gold-base">
							Join the community
						</p>
						<p className="mt-2 font-jakarta text-sm text-text-muted">
							Come and play. Tell us what you think. Help us build this
							thing.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<a
							href="https://x.com/tetrodegames"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-sm border border-surface-3 bg-surface-1 px-5 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-text-secondary transition-all hover:border-surface-4 hover:bg-surface-2 hover:text-text-primary"
						>
							Twitter / X
						</a>
						<a
							href="https://t.me/tetrodegames"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 rounded-sm border border-gold-base/40 bg-gold-base/10 px-5 py-2.5 font-ps2p text-[8px] uppercase tracking-wider text-gold-base transition-all hover:border-gold-base hover:bg-gold-base hover:text-surface-0"
						>
							Telegram
						</a>
					</div>
				</section>
			</div>
		</div>
	);
}
