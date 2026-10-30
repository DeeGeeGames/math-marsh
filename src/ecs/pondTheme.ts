import type { EquationPromptKind } from './types';

const pondThemes = {
	selectResult: {
		phase: 'morning',
		water: ['#119daf', '#0b879f', '#086e88'],
		light: '255, 231, 161',
		ripple: '218, 250, 239',
		bank: '#102b31',
		bankHighlight: '#75c72b',
		fireflyOpacity: 0,
	},
	selectOperands: {
		phase: 'dusk',
		water: ['#8b527e', '#604b81', '#304568'],
		light: '255, 195, 132',
		ripple: '255, 214, 192',
		bank: '#102b31',
		bankHighlight: '#a99761',
		fireflyOpacity: 0.45,
	},
	selectOperandAndResult: {
		phase: 'night',
		water: ['#225b87', '#1b426f', '#122e51'],
		light: '194, 225, 255',
		ripple: '175, 215, 249',
		bank: '#102b31',
		bankHighlight: '#729ca3',
		fireflyOpacity: 0.85,
	},
} as const;

export type PondTheme = (typeof pondThemes)[keyof typeof pondThemes];
export type PondPhase = PondTheme['phase'];

// Follow the equation cycle itself so tutorials and later number sets agree.
export function pondThemeForPromptKind(promptKind: EquationPromptKind): PondTheme {
	if (promptKind === 'selectLeftOperand' || promptKind === 'selectRightOperand') return pondThemes.selectResult;
	return pondThemes[promptKind];
}
