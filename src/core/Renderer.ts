import * as StateManager from "./StateManager";
import * as AudioPlayer from "./AudioPlayer";
import { Audio } from "nitro-fs";
import * as PianoRenderer from "./PianoRenderer";
import { TimelineRenderer } from "./TimelineRenderer";

let noteRange: [Audio.Note, Audio.Note] = [
	Audio.Note.CNegative1,
	Audio.Note.B8
];
let pianoHeight = 0.1;
let pianoPosition = 0.7;

let colors = Array.from(
	{ length: 16 },
	(_, i) => `hsl(${(i * 360) / 16}, 100%, 50%)`
);

let topTimeline: TimelineRenderer;
let bottomTimeline: TimelineRenderer;

let topTime = 1.5;
let bottomTime = -1;
let bottomSameSpeed = true;

let topChannels = 0xffff;
let pianoChannels = 0xffff;
let bottomChannels = 0xffff;

export function init() {
	PianoRenderer.init();

	topTimeline = new TimelineRenderer(
		document.getElementById("topTimelineCanvas") as HTMLCanvasElement
	);
	bottomTimeline = new TimelineRenderer(
		document.getElementById("bottomTimelineCanvas") as HTMLCanvasElement
	);

	addEventListener("resize", resize);
	resize();

	requestAnimationFrame(render);
}

export function resize() {
	const pianoHeightPixels = pianoHeight * window.innerHeight;
	topTimeline.resize(
		0,
		window.innerWidth,
		window.innerHeight * pianoPosition
	);

	PianoRenderer.resize(
		pianoPosition * window.innerHeight,
		window.innerWidth,
		pianoHeightPixels
	);
	PianoRenderer.drawKeys(noteRange[0], noteRange[1]);

	const bottomHeight =
		window.innerHeight * (1 - pianoPosition) - pianoHeightPixels;
	bottomTimeline.resize(
		window.innerHeight * pianoPosition + pianoHeightPixels,
		window.innerWidth,
		bottomHeight
	);

	// Same speed
	if (bottomSameSpeed) {
		const topSpeed = topTime / (window.innerHeight * pianoPosition);
		bottomTime = -bottomHeight * topSpeed;
	}
}

function render() {
	const time = AudioPlayer.getTime();
	topTimeline.draw(colors, time, noteRange, [0, topTime], topChannels);
	bottomTimeline.draw(
		colors,
		time,
		noteRange,
		[bottomTime, 0],
		bottomChannels
	);

	const state = StateManager.getState(time);
	PianoRenderer.clearNotes();
	if (state) {
		for (let i = 0; i < state.channels.length; i++) {
			if ((pianoChannels & (1 << i)) === 0) {
				continue;
			}

			const channel = state.channels[i];
			for (const note of channel.playing) {
				if (note.state === Audio.EnvelopeState.Release) {
					continue;
				}

				PianoRenderer.drawNote(
					Math.round(note.note),
					noteRange,
					note.volume,
					colors[i]
				);
			}
		}
	}

	requestAnimationFrame(render);
}

export function setPianoPosition(position: number) {
	pianoPosition = position;
	resize();
}

export function setPianoHeight(height: number) {
	pianoHeight = height;
	resize();
}

export function alignNotesToPiano(value: boolean) {
	TimelineRenderer.alignNotesToPiano(value);
}

export function setOutOfRangeBehaviour(value: string) {
	switch (value) {
		default:
		case "On Keys":
			PianoRenderer.setDrawOutOfRange(true);
			TimelineRenderer.setDrawOutOfRange(false);
			break;
		case "On Timeline":
			PianoRenderer.setDrawOutOfRange(false);
			TimelineRenderer.setDrawOutOfRange(true);
			break;
		case "On Both":
			PianoRenderer.setDrawOutOfRange(true);
			TimelineRenderer.setDrawOutOfRange(true);
			break;
		case "Off":
			PianoRenderer.setDrawOutOfRange(false);
			TimelineRenderer.setDrawOutOfRange(false);
			break;
	}
}

export function setPianoRange(value: [number, number]) {
	noteRange = value;
	PianoRenderer.drawKeys(noteRange[0], noteRange[1]);
}

export function showChannel(
	place: "top" | "piano" | "bottom",
	channel: number
) {
	switch (place) {
		case "top":
			topChannels |= 1 << channel;
			break;
		case "piano":
			pianoChannels |= 1 << channel;
			break;
		case "bottom":
			bottomChannels |= 1 << channel;
			break;
	}
}

export function hideChannel(
	place: "top" | "piano" | "bottom",
	channel: number
) {
	switch (place) {
		case "top":
			topChannels &= ~(1 << channel);
			break;
		case "piano":
			pianoChannels &= ~(1 << channel);
			break;
		case "bottom":
			bottomChannels &= ~(1 << channel);
			break;
	}
}

export function setChannelColor(channel: number, color: string) {
	colors[channel] = color;
}
