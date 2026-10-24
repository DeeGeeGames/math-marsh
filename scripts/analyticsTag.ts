export const ANALYTICS_MEASUREMENT_ID = 'G-G5S0RL2WSS';
export const ANALYTICS_HOST = 'mathmarsh.deegeegames.com';

// Desktop packaging sets BASE_PATH to a relative file URL base. The public site
// uses an absolute Pages path, so the tag stays out of the Steam and desktop app.
const isDesktopBuild = function(basePath: string): boolean {
	return basePath === './';
};

export const analyticsTagForBuild = function(basePath: string): string {
	if (isDesktopBuild(basePath)) return '';
	const measurementId = JSON.stringify(ANALYTICS_MEASUREMENT_ID);
	const scriptSource = JSON.stringify(`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_MEASUREMENT_ID}`);
	const host = JSON.stringify(ANALYTICS_HOST);
	return `<script>
if (location.hostname === ${host} && !window.mathMarshDesktop) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){dataLayer.push(arguments);};
  window.gtag('js', new Date());
  window.gtag('config', ${measurementId}, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  var analyticsScript = document.createElement('script');
  analyticsScript.async = true;
  analyticsScript.src = ${scriptSource};
  document.head.appendChild(analyticsScript);
}
</script>`;
};
