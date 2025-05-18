import { dtypes } from "./internal.ts";
import { encodeRiff } from "./riff/mod.ts";
import { waveCodec, type WaveListChunk, type WaveListEntries, type WaveRiffChunk } from "./riff/wave.ts";
import type { WaveCodingModeMap, WaveFile } from "./types.ts";

/**
 * Encode audio into `.wav` content.
 * @param wav The content of audio and `.wav` information.
 * @param mode Encode mode, also known as "output format".
 * @returns 
 */
export async function encodeWav<M extends keyof WaveCodingModeMap>(
    wav: WaveFile<WaveCodingModeMap[M]>,
    mode: M,
): Promise<Blob> {
    const format = wav.format;
    let content: Blob;
    let infoEntries: WaveListEntries | null = null;

    if (wav.info) {
        const { comment, artist, trackName, albumName, albumTrackId, copyrightDate, software } = wav.info;
        infoEntries = {};
        if (comment) infoEntries.ICMT = comment;
        if (artist) infoEntries.IART = artist;
        if (trackName) infoEntries.INAM = trackName;
        if (albumName) infoEntries.IPRD = albumName;
        if (albumTrackId != null) infoEntries.IPRT = `${albumTrackId}`;
        if (copyrightDate) infoEntries.ICRD = copyrightDate;
        if (software) infoEntries.ISFT = software;
    }

    switch (mode) {
        case "raw-blob":
            content = wav.data as Blob;
            break;
        case "raw-buffer":
            content = new Blob([wav.data as ArrayBuffer]);
            break;
        case "channels-fmt":
        case "channels-float32": {
            const dtype = dtypes[format.audioFormat][format.bitsPerChannel];
            if (dtype == null) throw new Error(`Unsupported bits per channel: ${format.bitsPerChannel}`);
            const ArrayType = dtype[0];
            const channels = wav.data as ArrayLike<ArrayLike<number>>;
            const samples = channels[0].length;
            const typedContent = new ArrayType(samples * format.channels);

            switch (mode) {
                case "channels-fmt": {
                    for (let i = 0; i < samples; i++) {
                        for (let ch = 0; ch < format.channels; ch++) {
                            typedContent[i * format.channels + ch] = channels[ch][i];
                        }
                    }
                    break;
                }
                case "channels-float32": {
                    const rawMin = dtype[1];
                    const rawMax = dtype[2];

                    for (let i = 0; i < samples; i++) {
                        for (let ch = 0; ch < format.channels; ch++) {
                            const p = channels[ch][i];
                            const v = (p + 1) / 2 * (rawMax - rawMin) + rawMin;
                            typedContent[i * format.channels + ch] = v;
                        }
                    }

                    break;
                }
            }
            
            content = new Blob([typedContent]);
            break;
        }
        default:
            throw new Error(`Unknown input mode: ${mode}`);
    }

    return await encodeRiff<WaveRiffChunk>({
        type: "WAVE",
        content: [
            { id: "fmt ", ...wav.format },
            { id: "data", data: content },
            ...(infoEntries != null ? [{ id: "LIST", type: "INFO", entries: infoEntries } as WaveListChunk] : []),
        ],
        unknowns: [],
    }, waveCodec);
}
