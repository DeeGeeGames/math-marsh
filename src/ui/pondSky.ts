const stars = Array.from({ length: 36 }, (_, index) => ({
	x: 45 + (index * 137) % 1510,
	y: 55 + (index * 73) % 340,
	radius: 1.5 + (index % 3) * 0.65,
	opacity: 0.4 + (index % 4) * 0.18,
}));

// Scenery belongs to the gameplay DOM, behind the canvas and its controls.
export function pondSkyMarkup(): string {
	return `
		<div class="pond-scenery" aria-hidden="true">
			<div class="pond-sky"></div>
			<svg class="pond-stars" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false">
				${stars.map(star => `<circle cx="${star.x}" cy="${star.y}" r="${star.radius}" opacity="${star.opacity}" />`).join('')}
			</svg>
			<div class="pond-celestial"></div>
			${['near', 'far', 'high'].map(layer => `
				<svg class="pond-cloud pond-cloud--${layer}" viewBox="0 0 300 95" focusable="false">
					<path d="M16 76 C-2 72 0 49 22 45 C18 18 49 6 70 24 C82 -3 122 -3 138 23 C166 9 192 21 195 42 C221 29 247 40 248 58 C269 51 294 59 292 75 C287 90 39 95 16 76Z" />
				</svg>
			`).join('')}
			<svg class="pond-horizon" viewBox="0 400 1600 200" preserveAspectRatio="none" focusable="false">
				<path class="pond-hills-far" d="M0 474 C90 432 165 466 260 441 C355 410 440 450 530 444 C650 404 740 454 850 445 C965 412 1030 450 1125 438 C1240 400 1290 454 1400 435 C1485 420 1550 443 1600 432 L1600 533 L0 533Z" />
				<path class="pond-hills-near" d="M0 492 C130 465 230 492 340 478 C470 454 560 492 680 483 C810 459 910 489 1030 477 C1180 455 1280 485 1410 466 C1510 461 1560 472 1600 460 L1600 548 C1420 528 1340 548 1200 532 C1050 522 930 540 800 528 C635 512 545 539 410 524 C260 510 160 535 0 527Z" />
				<g class="pond-horizon-ripples">
					<path d="M20 563H235 M1250 570H1570 M60 584H180 M1410 594H1590 M230 554H355 M1160 550H1280" />
				</g>
			</svg>
			<svg class="pond-landscape" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false">
				<path class="pond-bank" d="M0 866 Q85 845 150 895 Q210 925 295 936 Q356 951 425 1000 H0Z M1600 864 Q1520 841 1460 890 Q1385 928 1320 947 Q1260 962 1210 1000 H1600Z" />
				<g class="pond-reeds">
					<path d="M47 937Q63 832 36 729 M76 960Q72 850 104 784 M110 978Q139 860 151 814 M1540 948Q1530 835 1560 740 M1507 970Q1476 862 1484 803 M1463 987Q1447 907 1419 860" />
					<path d="M39 950Q16 869 0 860 M84 967Q120 890 157 871 M1541 959Q1570 880 1600 875 M1505 980Q1470 919 1438 912" />
				</g>
				<g class="pond-cattails">
					<path d="M36 739L35 710 M105 791L107 767 M1560 750L1563 722 M1484 813L1484 791" />
				</g>
			</svg>
		</div>
	`;
}
