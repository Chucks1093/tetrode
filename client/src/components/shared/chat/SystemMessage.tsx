export type SystemEventType = 'default' | 'phase' | 'accusation' | 'vote' | 'result';

interface SystemMessageProps {
	id?: string;
	text: string;
	eventType?: SystemEventType;
}

function WaveLine({ uid, color, opacity = '0.35' }: { uid: string; color: string; opacity?: string }) {
	const patternId = `wave-${uid}`;
	return (
		<svg
			className="-mx-4 block sm:-mx-6"
			style={{ width: 'calc(100% + 2rem)', height: '10px' }}
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<defs>
				<pattern id={patternId} x="0" y="0" width="24" height="10" patternUnits="userSpaceOnUse">
					<path
						d="M0,5 Q6,1 12,5 Q18,9 24,5"
						fill="none"
						stroke={color}
						strokeWidth="1.5"
						strokeOpacity={opacity}
					/>
				</pattern>
			</defs>
			<rect width="100%" height="10" fill={`url(#${patternId})`} />
		</svg>
	);
}

export function SystemMessage({ id = 'sys', text, eventType = 'default' }: SystemMessageProps) {
	if (eventType === 'phase') {
		return (
			<div className="flex flex-col items-center gap-1.5 py-1">
				<WaveLine uid={`${id}-top`} color="var(--gold-base)" opacity="0.45" />
				<span className="px-3 py-1 font-ps2p text-[9px] uppercase tracking-[0.22em] text-gold-bright [text-shadow:0_0_12px_var(--gold-base)]">
					{text}
				</span>
				<WaveLine uid={`${id}-bot`} color="var(--gold-base)" opacity="0.45" />
			</div>
		);
	}

	if (eventType === 'vote') {
		return (
			<div className="flex justify-center py-0.5">
				<span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-400">
					{text}
				</span>
			</div>
		);
	}

	if (eventType === 'accusation') {
		return (
			<div className="flex justify-center py-0.5">
				<span className="flex items-center gap-1.5 rounded-full border border-terracotta/25 bg-terracotta/10 px-4 py-1 text-[11px] text-terracotta-bright">
					<span className="text-terracotta-bright">!</span>
					{text}
				</span>
			</div>
		);
	}

	if (eventType === 'result') {
		return (
			<div className="flex flex-col items-center gap-2 py-2">
				<WaveLine uid={`${id}-top`} color="var(--terracotta)" opacity="0.5" />
				<span className="px-5 py-2 text-center font-ps2p text-[9px] uppercase leading-loose tracking-widest text-terracotta-bright [text-shadow:0_0_16px_var(--terracotta)]">
					{text}
				</span>
				<WaveLine uid={`${id}-bot`} color="var(--terracotta)" opacity="0.5" />
			</div>
		);
	}

	/* default */
	return (
		<div className="flex flex-col items-center gap-1 py-0.5">
			<WaveLine uid={id} color="var(--surface-4)" opacity="0.8" />
			<span className="bg-surface-1 px-3 font-ps2p text-[7px] uppercase tracking-widest text-text-muted">
				{text}
			</span>
		</div>
	);
}
