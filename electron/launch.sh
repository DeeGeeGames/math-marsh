#!/bin/sh
cd "$(dirname "$0")"

set -- --no-sandbox

# Force X11 under Wayland to work around Electron/Ozone rendering issues.
if [ -n "$WAYLAND_DISPLAY" ]; then
	set -- "$@" --ozone-platform=x11
fi

exec ./math-marsh "$@"
