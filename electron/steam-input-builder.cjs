// Used only by the explicit Steam Input diagnostic build.
const { build } = require('../package.json');
module.exports = {
	...build,
	extraMetadata: { main: 'dist-steam-input/main.cjs' },
	files: [...build.files, 'dist-steam-input/**'],
	asarUnpack: ['node_modules/steamworks-ffi-node/**', 'node_modules/koffi/**', 'node_modules/@koromix/**'],
	extraResources: [{ from: 'steam/input-test', to: 'steam-input' }, {
		from: 'steamworks_sdk/redistributable_bin',
		to: 'steamworks_sdk/redistributable_bin',
		filter: process.platform === 'win32' ? ['win64/steam_api64.dll'] : ['linux64/libsteam_api.so'],
	}],
};
