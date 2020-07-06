/**
 * Copyright (C) 2017 Peter Torelli <peter.j.torelli@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

// Thanks to D. Walsh: https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate)
				func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow)
			func.apply(context, args);
	};
};

let PIXEL_RATIO = (function () {
	let 
		ctx = document.createElement("canvas").getContext("2d"),
		dpr = window.devicePixelRatio || 1,
		bsr = 
			ctx.webkitBackingStorePixelRatio ||
			ctx.mozBackingStorePixelRatio ||
			ctx.msBackingStorePixelRatio ||
			ctx.oBackingStorePixelRatio ||
			ctx.backingStorePixelRatio || 1;
	return dpr / bsr;
})();

console.warn({PIXEL_RATIO})

// ODD, we no longer need pixel ratio?
PIXEL_RATIO = 1

function StripChart(id) {
	this.initializeMemberData();
	this.initializeProperties();
	this.initializeDomObjects(id);
};

StripChart.prototype.initializeMemberData = function() {
	// Interactivity
	this.autoScaleY = false;
	this.mouseStatus = undefined;
	// mousePos is in UCS coords
	this.mousePos = { x: 0, y: 0 };
	// Zoom is in UCS coords
	this.zoomWindow = { start: {x: 0, y: 0}, end: {x: 0, y: 0} };
	// HTML5 chart 2D context
	this.ctx;
	// pixels per unit; for switching between coordinate systems
	this.xppu = 1.0;
	this.yppu = 1.0;
	this.clearData();
	// In canvas pixel Cartesian (flipped) coordinates
	this.chartRect = { tx: 0, ty: 0, w: 0, h: 0 };
	// properties
	this.p = new Map();

	this.zoomStack = []
};

StripChart.prototype.setAutoScaleY = function (autoscale) {
	this.autoScaleY = autoscale ? true : false;
	// Rather than .draw() we need to change the zoom extents!
	this.zoomX();
};

StripChart.prototype.initializeProperties = function() {
	// TODO ditch the Map() and just use this.* like <CANVAS> does?
	this.p.set('title', undefined);
	this.p.set('xlabel', undefined);
	this.p.set('ylabel', undefined);
	this.p.set('xtics', 'auto');
	this.p.set('ytics', 'auto');
	this.p.set('origin', true);
	this.p.set('pad', [80, 70, 40, 35]); // L, B, T, R
	// TODO support multiple series
	this.p.set('stroke-style', 'red');
	this.p.set('line-width', '0.5');
	// Straight-up HTML5 here, Gnuplot typeface handling is painful
	this.p.set('font', undefined);
};

StripChart.prototype.initializeDomObjects = function(id) {
	this.id = id
	let node = document.getElementById(id)
	this.targetChart = node.querySelector('.strip-chart')
	if (this.targetChart == null) {
		throw new RangeError(`Target DIV ${id} not found`)
	}

	// The main chart canvas
	const cvs = document.createElement('canvas')
	cvs.style.position = 'absolute'
	cvs.style['z-index'] = 1
	cvs.className += ' chart'
	this.ctx = cvs.getContext('2d')
	this.targetChart.appendChild(cvs)

	// Use this for the selection region; makes drawing more responsive
	const overlay = document.createElement('canvas')
	overlay.style.position = 'absolute'
	overlay.style['z-index'] = 2
	overlay.className += ' overlay'
	overlay.setAttribute('data-target', id);
	this.ctxOverlay = overlay.getContext('2d');
	this.targetChart.appendChild(overlay)

	// OK, now that everything is created, resize!
	this.resize();

	/**
	 * These were originally callbacks, but now they instantiate if the
	 * object classes exist in the DOM under `<this ID>-controls`:
	 *
	 * .xcoord = a formatted x-coordinate
	 * .ycoord = a formatted y-coordinate
	 * .reset  = reset zoom if there is any
	 */
	console.log()


	this.xcoordElement = node.querySelector('.xcoord')
	this.ycoordElement = node.querySelector('.ycoord')
	let btn
	btn = node.querySelector('.reset')
	if (btn) {
		btn.addEventListener('click', () => {
			this.resetZoom()
		})
		// Don't allow zooming if there is no reset button
		overlay.addEventListener('click', event => {
			this.handleMouse('click', event.offsetX, event.offsetY);
		})
	}
	btn = node.querySelector('.previous')
	if (btn) {
		btn.addEventListener('click', () => {
			this.lastZoom()
		})
	}

	overlay.addEventListener('mousemove', event => {
		this.handleMouse('move', event.offsetX, event.offsetY);
	})
	overlay.addEventListener('mouseleave', event => {
		this.handleMouse('leave', event.offsetX, event.offsetY);
	})

	window.onresize = debounce(() => {
		this.resize();
		this.draw();
	}, 250)
	
}

StripChart.prototype.lastZoom = function() {
	if (this.zoomStack.length < 1) {
		return
	}
	let zoom = this.zoomStack.pop()
	this.visible.max.x = zoom.max.x
	this.visible.max.y = zoom.max.y
	this.visible.min.x = zoom.min.x
	this.visible.min.y = zoom.min.y
	this.draw()
}

/**
 * The subscriber to the object must provide a reset zoom control, so use
 * the following three functions to manage it.
 */
StripChart.prototype.resetZoom = function() {
	this.zoomStack = []
	// Zoom is in UCS coords
	this.zoomWindow = { start: {x: 0, y: 0}, end: {x: 0, y: 0} }
	this.visible.max.x = this.dataLimits.max.x
	this.visible.max.y = this.dataLimits.max.y
	this.visible.min.x = this.dataLimits.min.x
	this.visible.min.y = this.dataLimits.min.y
	this.visible.p1 = 0
	this.visible.p2 = 0
	this.draw()
}

// Given an offset in the div coordinate space, convert it to a UCS
StripChart.prototype.xlateOffset = function(offx, offy) {
	let x = offx;
	let y = offy;
	y = this.ctx.canvas.getBoundingClientRect().height - y; // flip
	x -= this.chartRect.tx; // offset tx,ty pad
	y -= this.chartRect.ty;
	x /= this.xppu; // convert to units
	y /= this.yppu;
	x += this.visible.min.x; // shift for view
	y += this.visible.min.y;
	return { x, y };
};

/**
 * Returns a boolean to indicate of a point in the chart coordinate system
 * is actual in the rendering range of the chart and not in an axis title.
 */
StripChart.prototype.isPointInChart = function(p) {
	let inx = p.x <= this.visible.max.x && p.x >= this.visible.min.x;
	let iny = p.y <= this.visible.max.y && p.y >= this.visible.min.y;
	return inx && iny;
};

StripChart.prototype.zoomX = function(x1, x2, noMin) {
	if (this.dataBuffer == undefined) {
		return
	}
	x1 = (x1 !== undefined) ? x1 : this.zoomWindow.start.x;
	x2 = (x2 !== undefined) ? x2 : this.zoomWindow.end.x;
	// Smallest selection width is 5px unless we REALLY want the interval
	if (!noMin && Math.abs(x2 - x1) < (5 / this.xppu)) {
		return;
	}
	// All x-ranges start at zero
	let p1 = x1
	let p2 = x2
	let tmp;
	if (p1 > p2) {
		tmp = p1;
		p1 = p2;
		p2 = tmp;
	}
	// Autorange y-axis
	let sample1 = Math.floor((p1 - this.xstart) / this.xstep)
	let sample2 = Math.ceil((p2 - this.xstart) / this.xstep)
	// Don't zoom too small
	if ((sample2 - sample1) < 10) {
		return
	}
	let stats = fstats(this.dataBuffer, sample1, (sample2 - sample1))
	
	this.zoomStack.push({
		min: { x: this.visible.min.x, y: this.visible.min.y },
		max: { x: this.visible.max.x, y: this.visible.max.y },
	})

	this.visible.min.x = p1
	this.visible.min.y = stats.min;
	this.visible.max.x = p2
	this.visible.max.y = stats.max;
	this.draw()
}

/**
 * This clears the overlay rectangle and updates the zoomWindow if there is
 * a position point defined.
 */
StripChart.prototype.dragZoom = function(pos) {
	this.ctxOverlay.clearRect(
		0, 0, 
		this.ctxOverlay.canvas.width, this.ctxOverlay.canvas.height)
	if (pos === undefined) {
		return
	}
	this.zoomWindow.end.x = pos.x
	if (this.zoomWindow.end.x < this.visible.min.x) {
		this.zoomWindow.end.x = this.visible.min.x
	} else if (this.zoomWindow.end.x > this.visible.max.x) {
		this.zoomWindow.end.x = this.visible.max.x
	}
	this.overlayHighlight(this.zoomWindow.start.x, this.zoomWindow.end.x)
}

/**
 * The point 'p' has already been translated from mouse coordiantes to graph
 * coordinates. A point might be outside the graph if it is in the axis title
 * area, for example.
 */
StripChart.prototype.updateGps = function(p) {
	if (!this.isPointInChart(p)) {
		return
	}
	if (this.xcoordElement) {
		let xlog = Math.log10(1 / this.xppu)
		// We only need fixed points when the units per pixel is less than 1
		let xplaces = xlog < 0 ? Math.ceil(xlog * -1) : 0
		this.xcoordElement.innerHTML = p.x.toFixed(xplaces)
	}
	if (this.ycoordElement) {
		let ylog = Math.log10(1 / this.yppu)
		// We only need fixed points when the units per pixel is less than 1
		let yplaces = ylog < 0 ? Math.ceil(ylog * -1) : 0
		this.ycoordElement.innerHTML = p.y.toFixed(yplaces)
	}
}

/**
 * When the mouse enters the focus of the chart, the GPS function is called
 * to update the coordinate elements (if they exist).
 *
 * If the user clicks the mouse inside the chart, the moust state changes to a
 * zoom drag, where an spyglass and an overlay indicate the potential zoom
 * window. If the user leaves the window the drag is cancelled, otherwise
 * the zoom function is called.
 */
StripChart.prototype.handleMouse = function(event, mx, my) {
	let p = this.xlateOffset(mx, my)
	if (event === 'move') {
		this.updateGps(p)
	}
	if (this.mouseState === undefined) {
		if (event === 'click') {
			if (!this.isPointInChart(p)) {
				return
			}
			this.mouseState = 'drag'
			this.zoomWindow.start = { x: p.x, y: p.y }
			this.zoomWindow.end = { x: p.x, y: p.y }
			this.dragZoom()
			this.ctxOverlay.canvas.style['cursor'] = 'zoom-in'
			let h = Math.abs(this.visible.max.y - this.visible.min.y)
			let w = 1 / this.xppu
			this.pushChartTransform(this.ctxOverlay)
			this.ctxOverlay.fillStyle = 'black'
			this.ctxOverlay.globalAlpha = 0.25
			this.ctxOverlay.fillRect(
				this.zoomWindow.start.x, 
				this.visible.min.y,
				w, h)
			this.ctxOverlay.restore()
		}
	} else if (this.mouseState === 'drag') {
		if (event === 'click' || event === 'leave') {
			this.mouseState = undefined
			this.dragZoom()
			this.ctxOverlay.canvas.style['cursor'] = 'auto'
			if (event === 'click') {
				this.zoomX() // clear overlay
			}
		} else {
			this.dragZoom(p)
		}
	}
}

StripChart.prototype.get = function(key) {
	return this.p.get(key);
};

StripChart.prototype.set = function(key, value) {
	return this.p.set(key, value);
};

StripChart.prototype.numFmt = function(value, axis) {
	let step;
	let pstep;
	if (axis === 'x') {
		pstep = this.p.get('xtics') || 'auto';
		step = this.generateTicStep(this.visible.min.x, 
			this.visible.max.x, pstep);
	} else {
		pstep = this.p.get('ytics') || 'auto';
		step = this.generateTicStep(this.visible.min.y, 
			this.visible.max.y, pstep);
	}
	let log10 = Math.log10(step);
	let floor = Math.floor(log10);
	if (floor <= 0) {
		value = value.toFixed(-1 * floor);
	} else {
		value = parseInt(value);;
	}
	return value;
}

// Useful for determining dataset generation fidelity
StripChart.prototype.widthInPixels = function() {
	return this.chartRect.w;
};

StripChart.prototype.clearData = function() {
	// Dataset max & minx
	this.dataLimits = { 
		max: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER, },
		min: { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER, },
	};
	// Visible Range (provide a default so something is drawn)
	this.visible = { min: {x: 0, y: 0}, max: {x: 20, y: 50} };
};

// Find an appealing way to pick spacing without knowing font dimensions
StripChart.prototype.quantizeNormalTics = function(n0, n1) {
	let mag = Math.abs(n1 - n0);
	// Begin code taken from Gnuplot
	// Copyright 2000, 2004   Thomas Williams, Colin Kelley
	let power = Math.pow(10, Math.floor(Math.log10(mag)));
	let xnorm = mag / power;
	let posns = 20 / xnorm; 
	let tics;
	if (posns > 40)
		tics = 0.05;	/* eg 0, .05, .10, ... */
	else if (posns > 20)
		tics = 0.1;		/* eg 0, .1, .2, ... */
	else if (posns > 10)
		tics = 0.2;		/* eg 0,0.2,0.4,... */
	else if (posns > 4)
		tics = 0.5;		/* 0,0.5,1, */
	else if (posns > 2)
		tics = 1;		/* 0,1,2,.... */
	else if (posns > 0.5)
		tics = 2;		/* 0, 2, 4, 6 */
	else
		/* getting desperate... the ceil is to make sure we
		 * go over rather than under - eg plot [-10:10] x*x
		 * gives a range of about 99.999 - tics=xnorm gives
		 * tics at 0, 99.99 and 109.98  - BAD !
		 * This way, inaccuracy the other way will round
		 * up (eg 0->100.0001 => tics at 0 and 101
		 * I think latter is better than former
		 */
		tics = Math.ceil(xnorm);
	return tics * power;
	// End Gnuplot code
};

StripChart.prototype.generateTicStep = function(min, max, step) {
	let cstep;
	if (typeof step === 'string') {
		if (step === 'auto') {
			cstep = this.quantizeNormalTics(min, max);
		} else {
			let found;
			if (found = step.match(/fixed\s+(\d+)/)) {
				if (found[1] < 2)
					throw new RangeError('too few number of user tics');
				cstep = (max - min) / (found[1] - 1);
			} else {
				throw new SyntaxError('unknow tic format: ' + step);
			}
		}
	} else if (typeof step === 'array') {
		// for future forced tics
	} else {
		cstep = step;
	}
	return cstep;
}

/**
 * Create an array of tic locations between min and max of size step.
 * Useful for creating axes. Deciding where to center/start is a matter
 * of aesthetics.
 */
StripChart.prototype.generateTicRange = function(min, max, step) {
	let cstep = this.generateTicStep(min, max, step);
	// [min,max] should be a multiple of cstep to avoid weird tics
	// Create [min,newmin,newmax,max]
	let q;
	q = parseInt(min / cstep);
	let newmin = q * cstep;
	if (newmin < min) {
		newmin += cstep;
	}
	q = parseInt(max / cstep);
	let newmax = q * cstep;
	if (newmax > max) {
		newmax -= cstep;
	}
	let result = [];
	for (let i = newmin; i <= max; i += cstep) {
		result.push(i);	
	}
	return result;
};

/**
 * Use this to draw in the functional coordinate system; e.g. the lower
 * left of the draw area will be the range [minx,miny] in function units.
 *
 * IMPORTANT: The callee must do the .restore()
 */
StripChart.prototype.pushChartTransform = function(ctx) {
	if (ctx === undefined) {
		ctx = this.ctx
	}
	ctx.save()
	// Flip
	ctx.scale(1, -1)
	// Shift for canvas height
	ctx.translate(0, -1 * ctx.canvas.getBoundingClientRect().height)
	// Shift for offset into canvas
	ctx.translate(this.chartRect.tx, 0)
	ctx.translate(0, this.chartRect.ty)
	// Scale from pixels to unit vectors
	ctx.scale(this.xppu, this.yppu)
	// Shift for range into view
	ctx.translate(-1 * this.visible.min.x, -1 * this.visible.min.y)
}

/**
 * When stroking lines, if the transform isn't reset, the lineWidth scales. A
 * common trick is to .restore() before stroking, but doing so deletes any
 * .clip() regions defined. Ugh. So use this before stroking, then issue 
 * the .restore().
 */
StripChart.prototype.restoreTransform = function(ctx) {
	ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
	ctx.restore()
};

// Wait why aren't we using Math.func functions?
function fstats (buffer, offsetSamples=0, nSamples=0) {
	let totalSamples = buffer.length
	if (nSamples == 0) {
		nSamples = totalSamples
	} else {
		if (offsetSamples + nSamples > totalSamples) {
			nSamples = totalSamples - offsetSamples
		}
	}
	let max = -1 * Number.MAX_VALUE
	let min = Number.MAX_VALUE
	let avg = 0
	let v
	for (let samples = 0; samples < nSamples; ++samples) {
		v = buffer[samples + offsetSamples]
		max = max > v ? max : v
		min = min < v ? min : v
		avg += v
	}
	avg /= nSamples
	return { min, avg, max }
}

StripChart.prototype.setData = function(xstep, buffer, xstart=0) {
	this.xstep = xstep
	this.dataBuffer = buffer
	this.xstart = xstart

	// A strip-chart has uniform distance between points (i.e., `xstep`)
	let xmin = xstart
	let xmax = xstart + (this.dataBuffer.length * this.xstep)
	this.dataLimits.min.x = xmin
	this.dataLimits.max.x = xmax

	// The max/min of the dataset determines the Y-limits
	let stats = fstats(this.dataBuffer)
	this.dataLimits.min.y = stats.min
	this.dataLimits.max.y = stats.max

	// Start by rendering ALL of the data (i.e., non-zoomed)
	this.visible.min.x = this.dataLimits.min.x
	this.visible.max.x = this.dataLimits.max.x
	this.visible.min.y = this.dataLimits.min.y
	this.visible.max.y = this.dataLimits.max.y
}

StripChart.prototype.draw = function () {
	this.drawTemplate()
	this.drawData()
}

StripChart.prototype.drawTemplate = function () {
	this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
	this.clearOverlay();
	// TODO: Hmmm... this computation should not be here.
	// update the number of pixels per visible unit
	let denx = Math.abs(this.visible.max.x - this.visible.min.x)
	let deny = Math.abs(this.visible.max.y - this.visible.min.y);
	// BUGBUG: There's a bug here, see chart6
	this.xppu = denx === 0 ? 10 : this.chartRect.w / denx;
	this.yppu = deny === 0 ? 10 : this.chartRect.h / deny;
	this.drawGridlines();
	this.drawOriginAxes();
	this.drawText();
}

StripChart.prototype.drawData = function () {

	if (this.dataBuffer == undefined || this.dataBuffer.length < 2) {
		return
	}

	/**
	 * When the number of samples in the viewport is small, stopping at the
	 * nearest inclusive samples fails to render the lines extending out of
	 * the chart area. Instead, always pick lhs/rhs points that are one beyond
	 * the width of the visible area and clip the lines.
	 *
	 * TODO: Clipping does not appear to be working. Wondering if it is due to
	 *       float precision errors? Switch ceil and floor for lhs/rhs...
	 */
	let clipx = this.visible.min.x
	let clipy = this.visible.min.y
	let clipw = (this.visible.max.x - this.visible.min.x)
	let cliph = (this.visible.max.y - this.visible.min.y)

	/**
	 * These will be the sample interval indices, inclusive [lhs, rhs]. We
	 * need to shift by `xstart` so that the indices are 0-based.
	 */
	let lhs = Math.floor((this.visible.min.x - this.xstart) / this.xstep)
	let rhs = Math.ceil((this.visible.max.x - this.xstart) / this.xstep)
	let nSamples = rhs - lhs

	// I wrote this out in English to keep from getting confused
	let secondsPerSample = this.xstep
	let pixelsPerChart = this.chartRect.w
	// How wide is a pixel?
	let secondsPerChart = Math.abs(this.visible.max.x - this.visible.min.x)
	let secondsPerPixel = secondsPerChart / pixelsPerChart
	// how many samples are in that width?
	let samplesPerPixel = Math.floor(secondsPerPixel / secondsPerSample)
	// This is our downsample rate
	let bytesPerPixel = samplesPerPixel * 4

	this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
	this.clearOverlay()

	this.drawGridlines();
	this.drawOriginAxes();
	this.drawText();

	// Don't downsample if we have enough fidelity (or sparse data)
	if (samplesPerPixel <= 1) {
		this.pushChartTransform()
		//this.ctx.rect(clipx, clipy, clipw, cliph);
		//this.ctx.clip();
		this.ctx.beginPath();
		let x0 = (lhs * this.xstep) + this.xstart
		let y0 = this.dataBuffer[lhs];
		this.ctx.moveTo(x0, y0)
		for (let i = 0; i < nSamples; ++i) {
			let xi = ((i + lhs) * this.xstep) + this.xstart
			let yi = this.dataBuffer[i + lhs]
			this.ctx.lineTo(xi, yi)
		}
		this.restoreTransform(this.ctx)
		this.ctx.lineWidth = this.p.get('line-width')
		this.ctx.strokeStyle = this.p.get('stroke-style')
		this.ctx.stroke()
		return
	}
	// Rather than looping through fstats three times, do it once
	let substats
	let maxs = new Float32Array(nSamples)
	let mins = new Float32Array(nSamples)
	let avgs = new Float32Array(nSamples)
	let nIndex = nSamples / samplesPerPixel
	for (let offset, i = 0; i < nIndex; ++i) {
		offset = (i * samplesPerPixel ) + lhs
		substats = fstats(this.dataBuffer, offset, samplesPerPixel)
		mins[i] = substats.min
		avgs[i] = substats.avg
		maxs[i] = substats.max
	}
	let series = (data, color) => {
		this.pushChartTransform()
		//this.ctx.rect(clipx, clipy, clipw, cliph);
		//this.ctx.clip();
		this.ctx.beginPath();
		let x0 = (lhs * this.xstep) + this.xstart
		let y0 = data[0];
		this.ctx.moveTo(x0, y0)
		for (let x, i = 0; i < nIndex; ++i) {
			let xi = (((i * samplesPerPixel) + lhs) * this.xstep) + this.xstart
			let yi = data[i]
			this.ctx.lineTo(xi, yi)
		}
		this.restoreTransform(this.ctx)
		this.ctx.lineWidth = this.p.get('line-width')
		this.ctx.strokeStyle = color
		this.ctx.stroke()
	}
	series(mins, 'silver')
	series(maxs, 'silver')
	series(avgs, this.p.get('stroke-style'))
}

StripChart.prototype.drawYLabel = function() {
	let ylabel = this.p.get('ylabel');
	if (ylabel === undefined)
		return;
	this.ctx.save();
	this.ctx.translate(this.chartRect.tx * 0.20, 0);
	this.ctx.translate(0, this.ctx.canvas.getBoundingClientRect().height - this.chartRect.ty - this.chartRect.h / 2);
	this.ctx.rotate(Math.PI / -2.0);
	this.ctx.textBaseline = 'middle';
	this.ctx.textAlign = 'center';
	this.ctx.fillText(ylabel, 0, 0);
	this.ctx.restore();
};

StripChart.prototype.drawYTicValues = function() {
	let step = this.p.get('ytics');
	if (step === undefined)
		return;
	this.ctx.save();
	this.ctx.translate(this.chartRect.tx * 0.95, 0);
	// Shift down so the top of the chart is at MAX
	this.ctx.translate(0, this.ctx.canvas.height / PIXEL_RATIO 
		- this.chartRect.ty);
	this.ctx.translate(0, this.visible.min.y * this.yppu);
	this.ctx.textBaseline = 'middle';
	this.ctx.textAlign = 'right';
	let tics = this.generateTicRange(this.visible.min.y, 
		this.visible.max.y, step);
	tics.forEach(i => {
		let v = this.numFmt(i, 'y'); //PRINT#
		this.ctx.fillText(v, 0, -i * this.yppu);
	});
	this.ctx.restore();
};

StripChart.prototype.drawXLabel = function() {
	let xlabel = this.p.get('xlabel');
	if (xlabel === undefined)
		return;
	this.ctx.save();
	// can't flip and scale because fonts will be flipped and scaled
	this.ctx.translate(this.chartRect.tx, this.ctx.canvas.getBoundingClientRect().height);
	this.ctx.textBaseline = 'middle';
	this.ctx.textAlign = 'center';
	this.ctx.fillText(xlabel, this.chartRect.w / 2, - this.chartRect.ty * 1 / 3);
	this.ctx.restore();
};

StripChart.prototype.drawXTicValues = function() {
	let step = this.p.get('xtics');
	if (step === undefined)
		return;
	this.ctx.save();
	this.ctx.translate(0, this.ctx.canvas.getBoundingClientRect().height)
	// Don't forget x=tx is really the min.x value (scaled to pixels)
	this.ctx.translate(this.chartRect.tx - 
		(this.visible.min.x * this.xppu), 0);
	this.ctx.textBaseline = 'middle';
	this.ctx.textAlign = 'center';
	let tics = this.generateTicRange(this.visible.min.x, 
		this.visible.max.x, step);
	let y = -1 * this.chartRect.ty * 2 / 3;
	tics.forEach(i => {
		let v = this.numFmt(i, 'x'); //PRINT#
		this.ctx.fillText(v, i * this.xppu, y);
	});
	this.ctx.restore();
};

StripChart.prototype.drawChartTitle = function() {
	let title = this.p.get('title');
	if (title === undefined)
		return;
	this.ctx.save();
	// can't flip and scale because fonts will be flipped and scaled
	this.ctx.textBaseline = 'middle';
	this.ctx.textAlign = 'center';
	let titley = ((this.p.get('pad'))[2] /  2);
	this.ctx.fillText(title, this.ctx.canvas.getBoundingClientRect().width / 2, titley);
	this.ctx.restore();
}

StripChart.prototype.drawText = function() {
	// Not sure why I need to keep setting the font
	if (this.p.get('font'))
		this.ctx.font = this.p.get('font');
	this.drawChartTitle();
	this.drawXLabel();
	this.drawXTicValues();
	this.drawYLabel();
	this.drawYTicValues();
}

StripChart.prototype.drawVerticalGridlines = function() {
	let step = this.p.get('xtics');
	if (step === undefined)
		return;
	let tics = this.generateTicRange(this.visible.min.x, 
		this.visible.max.x, step);
	this.pushChartTransform();
	this.ctx.beginPath();
	tics.forEach(i => {
		this.ctx.moveTo(i, this.visible.max.y);
		this.ctx.lineTo(i, this.visible.min.y);
	});
	this.restoreTransform(this.ctx);
	this.ctx.lineWidth = 0.2;
	this.ctx.strokeStyle = 'gray';
	this.ctx.stroke();
};

StripChart.prototype.drawHorizontalGridlines = function() {
	let step = this.p.get('ytics');
	if (step === undefined)
		return;
	let tics = this.generateTicRange(this.visible.min.y, 
		this.visible.max.y, step);
	this.pushChartTransform();
	this.ctx.beginPath();
	tics.forEach(i => {
		this.ctx.moveTo(this.visible.max.x, i);
		this.ctx.lineTo(this.visible.min.x, i);
	});
	this.restoreTransform(this.ctx);
	this.ctx.lineWidth = 0.2;
	this.ctx.strokeStyle = 'gray';
	this.ctx.stroke();
};

StripChart.prototype.drawGridlines = function() {
	this.drawVerticalGridlines();
	this.drawHorizontalGridlines();
};

StripChart.prototype.drawOriginAxes = function() {
	this.pushChartTransform();
	this.ctx.beginPath();
	if (this.p.get('origin')) {
		// If either origin is visible, render a dark line there
		if (this.visible.min.y <= 0 && this.visible.max.y >= 0) {
			this.ctx.moveTo(this.visible.min.x, 0);
			this.ctx.lineTo(this.visible.max.x, 0);
		}
		if (this.visible.min.x <= 0 && this.visible.max.x >= 0) {
			this.ctx.moveTo(0, this.visible.min.y);
			this.ctx.lineTo(0, this.visible.max.y);
		}
	}
	if (0) {
		this.ctx.moveTo(this.visible.min.x, this.visible.max.y);
		this.ctx.lineTo(this.visible.min.x, this.visible.min.y);
		this.ctx.lineTo(this.visible.max.x, this.visible.min.y);
	}
	this.restoreTransform(this.ctx);
	this.ctx.lineWidth = 1;
	this.ctx.strokeStyle = 'black';
	this.ctx.stroke();

	this.pushChartTransform();
	this.ctx.beginPath();
	// weeeeird... doing a path fills one layer above 
	this.ctx.moveTo(this.visible.min.x, this.visible.min.y);
	this.ctx.lineTo(this.visible.min.x, this.visible.max.y);

	this.ctx.moveTo(this.visible.min.x, this.visible.max.y);
	this.ctx.lineTo(this.visible.max.x, this.visible.max.y);
	
	this.ctx.moveTo(this.visible.max.x, this.visible.max.y);
	this.ctx.lineTo(this.visible.max.x, this.visible.min.y);
	
	this.ctx.moveTo(this.visible.max.x, this.visible.min.y);
	this.ctx.lineTo(this.visible.min.x, this.visible.min.y);

	this.restoreTransform(this.ctx);
	this.ctx.lineWidth = 0.2;
	this.ctx.strokeStyle = 'gray';
	this.ctx.stroke();

};

StripChart.prototype.resize = function() {
	const w = this.targetChart.getBoundingClientRect().width;
	const h = this.targetChart.getBoundingClientRect().height;

	this.ctx.canvas.width = w * PIXEL_RATIO;
	this.ctx.canvas.height = h * PIXEL_RATIO;
	this.ctx.canvas.style.width = w + 'px';
	this.ctx.canvas.style.height = h + 'px';
	this.ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);

	this.ctxOverlay.canvas.width = w * PIXEL_RATIO;
	this.ctxOverlay.canvas.height = h * PIXEL_RATIO;
	this.ctxOverlay.canvas.style.width = w + 'px';
	this.ctxOverlay.canvas.style.height = h + 'px';
	this.ctxOverlay.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);

	let pad = this.p.get('pad');
	if (pad === undefined)
		pad = [0, 0, 0, 0];
	this.chartRect.tx = pad[0] ? pad[0] : 0;
	this.chartRect.ty = pad[1] ? pad[1] : 0;
	this.chartRect.w = this.ctx.canvas.width - this.chartRect.tx - (pad[2] ? pad[2] : 0);
	this.chartRect.h = this.ctx.canvas.height - this.chartRect.ty - (pad[3] ? pad[3] : 0);
}

StripChart.prototype.overlayHighlight = function(x1, x2) {
	if (x2 < x1) {
		let t = x1;
		x1 = x2;
		x2 = t;
	}
	let h = Math.abs(this.visible.max.y - this.visible.min.y);
	let w = x2 - x1;
	// Always draw something
	let minWidth = 1 / this.xppu; // 1pix
	w = w < minWidth ? minWidth : w;
	this.pushChartTransform(this.ctxOverlay);
	this.ctxOverlay.fillStyle = 'black';
	this.ctxOverlay.globalAlpha = 0.25;
	this.ctxOverlay.fillRect(x1, this.visible.min.y, w, h);
	this.ctxOverlay.restore();
}

StripChart.prototype.clearOverlay = function() {
	this.ctxOverlay.clearRect(0, 0, this.ctxOverlay.canvas.width, 
		this.ctxOverlay.canvas.height);
}


/**
 * For downloading, create an URL with the image data.
 */
StripChart.prototype.getDataURL = function() {
	let canvas = document.createElement('canvas');
	let context = canvas.getContext('2d');
	let w = this.targetChart.getBoundingClientRect().width
	let h = this.targetChart.getBoundingClientRect().height
	context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
	context.canvas.width = w * PIXEL_RATIO;
	context.canvas.height = h * PIXEL_RATIO;
	context.canvas.style.width = w + 'px';
	context.canvas.style.height = h + 'px';
	context.drawImage(this.ctx.canvas, 0, 0);
	return canvas.toDataURL('image/png', 1);
}

// todo nodify
//module.exports = StripChart
