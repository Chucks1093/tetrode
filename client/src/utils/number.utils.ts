export function padNumber(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

export function maskText(text: string): string {
	return text.replace(/[^\s]/g, '*');
}
