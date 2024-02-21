import { NitroFS, BufferReader, Audio } from "nitro-fs";
import { SynthState, createSynthState } from "./SynthState";

const handlers: Map<string, (data: any) => void> = new Map();
const callables: Map<string, (data: any) => void> = new Map();

onmessage = (e) => {
	if (handlers.has(e.data.type)) {
		handlers.get(e.data.type)!(e.data.data);
	}
}

handlers.set("call", (data) => {
	if (callables.has(data.type)) {
		try {
			const result = callables.get(data.type)!(data.data);
			postMessage({ type: "call", data: { id: data.id, data: { data: result } } });
		} catch (err) {
			postMessage({ type: "call", data: { id: data.id, data: { err: err } } });
		}
	}
});

let sdat: Audio.SDAT;

callables.set("parseNds", (data) => {
	const fs = NitroFS.fromRom(data);
	
	// Recursively search for .sdat files
	let sdats: string[] = [];
	function look(path: string) {
		const {files, directories} = fs.readDir(path);
		for (const file of files) {
			if (file.endsWith(".sdat")) {
				if (path === "") {
					sdats.push(file);
				} else {
					sdats.push(path + "/" + file);
				}
			}
		}

		for (const dir of directories) {
			if (path === "") {
				look(dir);
			} else {
				look(path + "/" + dir);
			}
		}
	}

	look("");

	return sdats;
});

callables.set("checkSdat", (data) => {
	const fs = NitroFS.fromRom(data.rom);
	const sdatBuffer = BufferReader.new(fs.readFile(data.path));

	const sdat = new Audio.SDAT(sdatBuffer);
	return sdat.fs.sequences.length;
});

callables.set("useSdat", (data) => {
	const fs = NitroFS.fromRom(data.rom);
	const sdatBuffer = BufferReader.new(fs.readFile(data.path));

	sdat = new Audio.SDAT(sdatBuffer);
});

callables.set("getSeqSymbols", (data) => {
	return sdat.fs.sequences.map((seq) => seq.name ? seq.name : `#${seq.id}`);
});

let renderer: Audio.SequenceRenderer;

callables.set("loadSeq", (data) => {
	renderer = new Audio.SequenceRenderer({
		file: Audio.SequenceRenderer.makeInfoSSEQ(sdat, data.name.startsWith("#") ? parseInt(data.name.slice(1)) : data.name),
		sampleRate: 48000,
		sink(buffer) {
			postMessage({ type: "pcm", data: buffer});
		},
		bufferLength: 1024 * 16
	});
});

callables.set("tickSeconds", (data) => {
	const states: SynthState[] = Array(Math.ceil(48000 * data.seconds / renderer.samplesPerTick));
	let o = 0;
	for (let i = 0; i < 48000 * data.seconds; i += renderer.samplesPerTick) {
		renderer.tick();
		states[o] = createSynthState(renderer);
		o++;
	}

	return states;
});