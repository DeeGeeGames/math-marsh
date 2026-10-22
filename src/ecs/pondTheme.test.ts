import { describe, expect, test } from 'bun:test';
import { pondThemeForPromptKind } from './pondTheme';

describe('pond themes', () => {
	test('single-answer missing operand prompts share the existing morning theme', () => {
		expect(pondThemeForPromptKind('selectLeftOperand')).toBe(pondThemeForPromptKind('selectResult'));
		expect(pondThemeForPromptKind('selectRightOperand')).toBe(pondThemeForPromptKind('selectResult'));
	});

	test('the existing Arcade prompt themes remain morning, dusk, and night', () => {
		expect(pondThemeForPromptKind('selectResult').phase).toBe('morning');
		expect(pondThemeForPromptKind('selectOperands').phase).toBe('dusk');
		expect(pondThemeForPromptKind('selectOperandAndResult').phase).toBe('night');
	});
});
