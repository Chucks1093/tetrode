import type {
	ComponentPropsWithoutRef,
	ComponentPropsWithRef,
	JSX,
	ReactNode,
	CSSProperties,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

const prismStyle = oneDark as { [key: string]: CSSProperties };

type ComponentType = keyof JSX.IntrinsicElements;

type MarkdownComponentProps<T extends ComponentType> = {
	children?: ReactNode;
} & ComponentPropsWithRef<T>;

type CodeProps = {
	inline?: boolean;
	className?: string;
	children?: ReactNode;
} & ComponentPropsWithoutRef<'code'>;

function normalizeCitationMarkerSpacing(content: string): string {
	return content.replace(/\]\s*\[/g, '] [');
}

function linkifyCitationMarkers(
	content: string,
	citationLinks: Record<number, string>
): string {
	if (!content) return content;

	const normalized = normalizeCitationMarkerSpacing(content);

	return normalized.replace(/\[(\d+)\]/g, (match, rawRank, offset, full) => {
		const rank = Number(rawRank);
		const url = citationLinks[rank];
		if (!url) return match;

		// Skip if already a markdown link label like [1](...)
		const nextChar = full[offset + match.length];
		if (nextChar === '(') return match;

		return `[[${rank}]](${url})`;
	});
}

const MarkdownComponents = {
	h1: ({ children, ...props }: MarkdownComponentProps<'h1'>) => (
		<h1
			className="mb-4 mt-8 text-2xl font-manrope font-medium text-odin-dark-1000 sm:mb-6 sm:mt-12 sm:text-4xl"
			{...props}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...props }: MarkdownComponentProps<'h2'>) => (
		<h2
			className="mb-4 mt-8 text-xl font-manrope font-medium text-odin-dark-1000 sm:mb-5 sm:mt-10 sm:text-3xl"
			{...props}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...props }: MarkdownComponentProps<'h3'>) => (
		<h3
			className="mb-3 mt-6 text-lg font-manrope font-medium text-odin-dark-1000 sm:mb-4 sm:mt-8 sm:text-2xl"
			{...props}
		>
			{children}
		</h3>
	),
	p: ({ children, ...props }: MarkdownComponentProps<'p'>) => (
		<p
			className="mb-4 text-[0.96rem] leading-7 font-inter text-odin-dark-1000 sm:mb-5 sm:text-[1.02rem] sm:leading-8"
			{...props}
		>
			{children}
		</p>
	),
	ul: ({ children, ...props }: MarkdownComponentProps<'ul'>) => (
		<ul
			className="mb-6 ml-6 list-outside list-disc space-y-2 text-odin-dark-1000-a-65"
			{...props}
		>
			{children}
		</ul>
	),
	ol: ({ children, ...props }: MarkdownComponentProps<'ol'>) => (
		<ol
			className="mb-6 ml-6 list-outside list-decimal space-y-2 text-odin-dark-1000-a-65"
			{...props}
		>
			{children}
		</ol>
	),
	li: ({ children, ...props }: MarkdownComponentProps<'li'>) => (
		<li
			className="pl-2 text-[0.95rem] leading-relaxed font-inter text-odin-dark-1000 sm:text-[1rem]"
			{...props}
		>
			{children}
		</li>
	),
	blockquote: ({
		children,
		...props
	}: MarkdownComponentProps<'blockquote'>) => (
		<blockquote
			className="my-6 border-l-4 border-odin-dark-500 pl-4 italic text-odin-dark-1000-a-65"
			{...props}
		>
			{children}
		</blockquote>
	),
	a: ({ children, ...props }: MarkdownComponentProps<'a'>) => (
		<a
			className="underline underline-offset-2 text-sky-300 hover:text-sky-200"
			target="_blank"
			rel="noreferrer"
			{...props}
		>
			{children}
		</a>
	),
	code: ({ inline, className, children, ...props }: CodeProps) => {
		const match = /language-(\w+)/.exec(className || '');
		return !inline && match ? (
			<div className="my-6">
				<SyntaxHighlighter
					//@ts-expect-error the styling is correct
					style={prismStyle}
					language={match[1]}
					PreTag="div"
					className="rounded-lg text-[15px]"
					{...props}
				>
					{String(children).replace(/\n$/, '')}
				</SyntaxHighlighter>
			</div>
		) : (
			<code
				className="rounded bg-odin-dark-500 px-2 py-1 font-mono text-sm text-odin-dark-1000"
				{...props}
			>
				{children}
			</code>
		);
	},
	img: ({ ...props }) => (
		<figure className="my-8">
			<img
				src={props.src}
				alt={props.alt || ''}
				className="rounded-lg w-full"
				loading="lazy"
				onError={event => {
					const figure = event.currentTarget.closest('figure');
					if (figure instanceof HTMLElement) {
						figure.style.display = 'none';
						return;
					}

					event.currentTarget.style.display = 'none';
				}}
			/>
			{props.alt && (
				<figcaption className="mt-2 text-sm text-odin-dark-1000-a-65">
					{props.alt}
				</figcaption>
			)}
		</figure>
	),
	hr: ({ ...props }: MarkdownComponentProps<'hr'>) => (
		<hr className="my-8 border-odin-dark-500" {...props} />
	),
	table: ({ children, ...props }: MarkdownComponentProps<'table'>) => (
		<div className="overflow-x-auto my-8">
			<table className="min-w-full divide-y divide-odin-dark-500" {...props}>
				{children}
			</table>
		</div>
	),
	thead: ({ children, ...props }: MarkdownComponentProps<'thead'>) => (
		<thead className="bg-odin-dark-400" {...props}>
			{children}
		</thead>
	),
	tr: ({ children, ...props }: MarkdownComponentProps<'tr'>) => (
		<tr className="border-b border-odin-dark-500" {...props}>
			{children}
		</tr>
	),
	th: ({ children, ...props }: MarkdownComponentProps<'th'>) => (
		<th
			className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-odin-dark-1000-a-65"
			{...props}
		>
			{children}
		</th>
	),
	td: ({ children, ...props }: MarkdownComponentProps<'td'>) => (
		<td
			className="whitespace-nowrap px-6 py-4 text-sm text-odin-dark-1000-a-65"
			{...props}
		>
			{children}
		</td>
	),
};

type StoryMarkdownContentProps = {
	content: string;
	citationLinks?: Record<number, string>;
	variant?: 'article' | 'comment';
};

export default function StoryMarkdownContent({
	content,
	citationLinks = {},
	variant = 'article',
}: StoryMarkdownContentProps) {
	const normalizedContent = linkifyCitationMarkers(content, citationLinks);
	const isComment = variant === 'comment';

	const components = isComment
		? {
				...MarkdownComponents,
				p: ({ children, ...props }: MarkdownComponentProps<'p'>) => (
					<p
						className="mb-2 text-sm leading-7 font-inter text-odin-dark-1000 last:mb-0 sm:text-[0.98rem] sm:leading-8"
						{...props}
					>
						{children}
					</p>
				),
				ul: ({ children, ...props }: MarkdownComponentProps<'ul'>) => (
					<ul
						className="mb-2 ml-5 list-outside list-disc space-y-1 text-odin-dark-1000"
						{...props}
					>
						{children}
					</ul>
				),
				ol: ({ children, ...props }: MarkdownComponentProps<'ol'>) => (
					<ol
						className="mb-2 ml-5 list-outside list-decimal space-y-1 text-odin-dark-1000"
						{...props}
					>
						{children}
					</ol>
				),
				img: ({ ...props }) => (
					<figure className="my-3">
						<img
							src={props.src}
							alt={props.alt || ''}
							className="rounded-lg w-full"
							loading="lazy"
							onError={event => {
								const figure = event.currentTarget.closest('figure');
								if (figure instanceof HTMLElement) {
									figure.style.display = 'none';
									return;
								}

								event.currentTarget.style.display = 'none';
							}}
						/>
						{props.alt && (
							<figcaption className="mt-1 text-xs text-odin-dark-1000-a-65">
								{props.alt}
							</figcaption>
						)}
					</figure>
				),
		  }
		: MarkdownComponents;

	return (
		<div className="[&_.katex-display]:my-8 [&_.katex-display]:rounded-lg [&_.katex-display]:border [&_.katex-display]:border-odin-dark-500 [&_.katex-display]:bg-odin-dark-400 [&_.katex-display]:p-4 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-sm [&_.katex-display]:text-odin-dark-1000 md:[&_.katex-display]:text-base [&_.katex]:text-sm md:[&_.katex]:text-base">
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeRaw, rehypeKatex]}
				components={components}
			>
				{normalizedContent}
			</ReactMarkdown>
		</div>
	);
}
