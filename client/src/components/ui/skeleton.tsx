import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'animate-pulse rounded-md bg-odin-dark-500/70',
				className
			)}
			{...props}
		/>
	);
}
