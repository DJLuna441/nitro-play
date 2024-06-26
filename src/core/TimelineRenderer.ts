import * as StateManager from "./StateManager";
import { interpolateNoteX } from "./PianoRenderer";
import { SynthState } from "./SynthState";
import { Audio } from "nitro-fs";

let alignNotes = true;
let drawOutOfRange = false;

export class TimelineRenderer {
	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.ctx = this.canvas.getContext("2d", { alpha: false })!;
	}

	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	draw(
		colors: string[],
		time: number,
		noteRange: [Audio.Note, Audio.Note],
		timeRange: [number, number],
		shownChannels: number
	) {
		if (this.canvas.height === 0) {
			return;
		}

		const noteRangeCount = noteRange[1] - noteRange[0];
		const absoluteTimeRange = [timeRange[0] + time, timeRange[1] + time];

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		let lastStateForChannel: SynthState | undefined;
		for (const states of StateManager.statesQueue) {
			if (states === undefined) {
				continue;
			}

			for (const s of states) {
				// Extend the bounds a little bit to avoid flickering
				if (
					s.time < absoluteTimeRange[0] - 0.1 ||
					lastStateForChannel === undefined
				) {
					lastStateForChannel = s;
					continue;
				}

				if (s.time > absoluteTimeRange[1] + 0.1) {
					break;
				}

				for (let i = 0; i < s.channels.length; i++) {
					if ((shownChannels & (1 << i)) === 0) {
						continue;
					}

					const channel = s.channels[i];

					this.ctx.fillStyle = colors[i];

					for (const note of channel.playing) {
						if (note.state === Audio.EnvelopeState.Release) {
							continue;
						}

						if (
							note.note < noteRange[0] ||
							noteRange[1] < note.note
						) {
							if (
								!drawOutOfRange ||
								note.state !== Audio.EnvelopeState.Attack
							)
								continue;

							const outOfRangeNoteSize = 10;
							const noteY =
								invLerp(
									absoluteTimeRange[0],
									absoluteTimeRange[1],
									s.time
								) * this.canvas.height;

							if (note.note < noteRange[0]) {
								//Path for a Triangle ◀
								this.ctx.beginPath();
								this.ctx.moveTo(
									outOfRangeNoteSize,
									this.canvas.height - noteY
								);
								this.ctx.lineTo(
									outOfRangeNoteSize,
									this.canvas.height -
										noteY -
										outOfRangeNoteSize
								);
								this.ctx.lineTo(
									0,
									this.canvas.height -
										noteY -
										outOfRangeNoteSize / 2
								);
								this.ctx.lineTo(
									outOfRangeNoteSize,
									this.canvas.height - noteY
								);
								this.ctx.fill();
								this.ctx.closePath();
							} else if (note.note > noteRange[0]) {
								//Path for a Triangle ▶
								this.ctx.beginPath();
								this.ctx.moveTo(
									this.canvas.width - outOfRangeNoteSize,
									this.canvas.height - noteY
								);
								this.ctx.lineTo(
									this.canvas.width - outOfRangeNoteSize,
									this.canvas.height -
										noteY -
										outOfRangeNoteSize
								);
								this.ctx.lineTo(
									this.canvas.width,
									this.canvas.height -
										noteY -
										outOfRangeNoteSize / 2
								);
								this.ctx.lineTo(
									this.canvas.width - outOfRangeNoteSize,
									this.canvas.height - noteY
								);
								this.ctx.fill();
								this.ctx.closePath();
							}
							continue;
						}

						const noteWidth =
							(this.canvas.width / noteRangeCount) * note.volume;

						let noteX: number;
						if (alignNotes) {
							noteX = interpolateNoteX(note.note) - noteWidth / 2;
						} else {
							noteX =
								((note.note - noteRange[0]) / noteRangeCount) *
									this.canvas.width -
								noteWidth / 2;
						}

						const noteY =
							invLerp(
								absoluteTimeRange[0],
								absoluteTimeRange[1],
								s.time
							) * this.canvas.height;
						const lastNoteY =
							invLerp(
								absoluteTimeRange[0],
								absoluteTimeRange[1],
								lastStateForChannel.time
							) * this.canvas.height;

						// Add 1 to remove small gaps between notes
						const noteHeight = Math.abs(noteY - lastNoteY) + 1;

						this.ctx.fillRect(
							noteX,
							this.canvas.height - noteY,
							noteWidth,
							noteHeight
						);
					}
				}

				lastStateForChannel = s;
			}
		}
	}

	resize(yPos: number, width: number, height: number) {
		if (height < 0) {
			height = 0;
		}

		this.canvas.width = width;
		this.canvas.height = height;
		this.canvas.style.top = `${yPos}px`;
	}

	static alignNotesToPiano(value: boolean) {
		alignNotes = value;
	}

	static setDrawOutOfRange(value: boolean) {
		drawOutOfRange = value;
	}
}

function invLerp(a: number, b: number, v: number) {
	return (v - a) / (b - a);
}
