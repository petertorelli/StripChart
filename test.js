'use strict';


const c1 = new StripChart('chart1');
c1.set('title', 'Default / Consolas');
c1.set('xlabel', 'Time (s)');
c1.set('ylabel', 'Energy (uJ)');
c1.set('font', '10pt Consolas, Courier, Fixed');


const c2 = new StripChart('chart2');
c2.set('title', 'Default / Courier');
c2.set('xlabel', 'Fornight');
c2.set('ylabel', 'Furlongs');
c2.set('font', '10pt Courier, Fixed');

const c3 = new StripChart('chart3');
c3.set('title', 'no Y origin, 12pt Garamond');
c3.set('xlabel', 'Time (s)');
c3.set('ylabel', 'Bouncieness');
c3.set('font', '12pt Garamond');
c3.set('stroke-style', 'blue');

const c4 = new StripChart('chart4');
c4.set('title', '2px line width, x-axis label bug');
c4.set('xlabel', 'Time (s)');
c4.set('ylabel', 'Energy (uJ)');
c4.set('font', '10pt Consolas, Courier, Fixed');
c4.set('line-width', '2');
c4.set('origin', undefined);
c4.set('stroke-style', 'orange');

const c5 = new StripChart('chart5');
c5.set('title', '1,000,000 points with noise [-3,0] zoom bug');

const c6 = new StripChart('chart6');
c6.set('title', 'noise, min/avg/max (zoom to see)');

const c7 = new StripChart('chart7');
c7.set('title', 'Resize w/Div, no zoom');


let ppu = (1 / c1.widthInPixels());

if (1) {
	let p0 = 50.2;
	let pn = 782.3;
	let step = ppu * Math.abs(pn - p0);
	let buffer = new Float32Array(c1.widthInPixels())
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		j = 5.35 * Math.sin(i / 150) - 1.3;
		buffer[k] = j
	}
	c1.setData(step, buffer, p0)
	c1.draw();
}
if (1) {
	// This one has a precision error with the auto picker
	let p0 = -1;
	let pn = 1.75;
	let step = ppu * Math.abs(pn - p0);
	let buffer = new Float32Array(c1.widthInPixels())
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		j = (5.05 / 2) * Math.pow(i, 3) - (3 / 2) * i; 
		buffer[k] = j
	}
	c2.setData(step, buffer, p0)
	c2.draw();
}
if (1)  {
	let p0 = -143.72;
	let pn = -25;
	let step = ppu * Math.abs(pn - p0);
	let buffer = new Float32Array(c1.widthInPixels())
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		if (i == 0)
			j = 1;
		else
			j = Math.sin(i) / i; 
		buffer[k] = j
	}
	c3.setData(step, buffer, p0)
	c3.draw();
}
if (1)  {
	let p0 = -209;
	let pn = -208.002;
	let step = ppu * Math.abs(pn - p0);
	let buffer = new Float32Array(c1.widthInPixels())
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		if (i == 0)
			j = 1;
		else
			j = Math.sin(i) / i; 
		buffer[k] = j
	}
	c4.setData(step, buffer, p0)
	c4.draw();
}
if (1)  {
	let p0 = -209;
	let pn = 17.2;
	let numPoints = 1e6;
	let step = Math.abs(pn - p0) / numPoints;
	let buffer = new Float32Array(numPoints)
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		if (i == 0)
			j = 1;
		else {
			j = Math.sin(i) / i
			j += j * ((Math.random() * 0.2) - 0.1)
		}
		buffer[k] = j
	}
	c5.setData(step, buffer, p0)
	c5.draw();
}

if (1) {
	let p0 = 0;
	let pn = 1;
	let numPoints = 1e6;
	let step = Math.abs(pn - p0) / numPoints;
	let buffer = new Float32Array(numPoints)
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		buffer[k] = Math.random() * 1
	}
	c6.setData(step, buffer, p0)
	c6.draw();
}

if (1) {
	let p0 = -10;
	let pn = 10;
	let numPoints = 1e3;
	let step = Math.abs(pn - p0) / numPoints;
	let buffer = new Float32Array(numPoints)
	for (let i=p0, j, k=0; i < pn; i += step, ++k) {
		j = Math.sin(i); 
		buffer[k] = j
	}
	c7.setData(step, buffer, p0)
	c7.draw();
}
