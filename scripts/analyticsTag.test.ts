import { describe, expect, test } from 'bun:test';
import { ANALYTICS_HOST, ANALYTICS_MEASUREMENT_ID, analyticsTagForBuild } from './analyticsTag';

describe('production analytics tag', () => {
	test('includes a page-view tag that loads only on the public site', () => {
		const tag = analyticsTagForBuild('/math-marsh/');
		expect(tag).toContain(ANALYTICS_MEASUREMENT_ID);
		expect(tag).toContain(`location.hostname === ${JSON.stringify(ANALYTICS_HOST)}`);
		expect(tag).toContain('!window.mathMarshDesktop');
		expect(tag).toContain('allow_google_signals: false');
		expect(tag).toContain('allow_ad_personalization_signals: false');
		expect(tag).toContain(`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_MEASUREMENT_ID}`);
		expect(tag.startsWith('<script>')).toBe(true);
		expect(tag.endsWith('</script>')).toBe(true);
	});

	test('omits the tag from the desktop build', () => {
		expect(analyticsTagForBuild('./')).toBe('');
	});
});
