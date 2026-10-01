import type { EquationPromptKind } from './types';

const pondThemes = {
	selectResult: {
		phase: 'morning',
		water: ['#65c6c5', '#288b9a', '#175c70'],
		light: '255, 231, 161',
		ripple: '218, 250, 239',
		bank: 'rgba(64, 115, 65, 0.52)',
		bankHighlight: 'rgba(242, 224, 151, 0.34)',
		reeds: 'rgba(33, 91, 48, 0.58)',
		fireflyOpacity: 0,
	},
	selectOperands: {
		phase: 'dusk',
		water: ['#bd8295', '#725f89', '#354b70'],
		light: '255, 195, 132',
		ripple: '255, 214, 192',
		bank: 'rgba(75, 69, 77, 0.64)',
		bankHighlight: 'rgba(255, 191, 126, 0.32)',
		reeds: 'rgba(64, 53, 66, 0.74)',
		fireflyOpacity: 0.45,
	},
	selectOperandAndResult: {
		phase: 'night',
		water: ['#365d85', '#243e67', '#152845'],
		light: '194, 225, 255',
		ripple: '175, 215, 249',
		bank: 'rgba(20, 42, 48, 0.72)',
		bankHighlight: 'rgba(161, 211, 218, 0.25)',
		reeds: 'rgba(16, 37, 42, 0.86)',
		fireflyOpacity: 0.85,
	},
} as const;

export type PondTheme = (typeof pondThemes)[EquationPromptKind];
export type PondPhase = PondTheme['phase'];

// Follow the equation cycle itself so tutorials and later number sets agree.
export function pondThemeForPromptKind(promptKind: EquationPromptKind): PondTheme {
	return pondThemes[promptKind];
}
