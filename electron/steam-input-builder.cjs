// Used only by the explicit Steam Input diagnostic build.
const { build } = require('../package.json');
module.exports = {
	...build,
	extraMetadata: { main: 'dist-steam-input/main.cjs' },
	files: ['dist-steam-input/**', 'package.json'],
	asarUnpack: ['node_modules/steamworks-ffi-node/**', 'node_modules/koffi/**', 'node_modules/@koromix/**'],
	extraResources: [{ from: 'steam/input-test', to: 'steam-input' }, {
		from: 'steamworks_sdk/redistributable_bin',
		to: 'steamworks_sdk/redistributable_bin',
		filter: ['win64/steam_api64.dll', 'linux64/libsteam_api.so'],
	}],
};
