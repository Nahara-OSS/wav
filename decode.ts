// deno-lint-ignore-file
import type { WaveFile, WaveCodingModeMap, TrackInfo } from "./types.ts";
import * as riff from "./riff/mod.ts";
import { dtypes } from "./internal.ts";

/**
 * Decode `.wav` file into format of your choice.
 * @param blob The blob containing the content of `.wav` file.
 * @param mode Decode mode. Depending on use case, one mode may be more suitable than others. For example, if you are
 * trying to decode `.wav` into `AudioBuffer`, you might want to use `channels-float32`, but if you just want to probe
 * format or metadata, `raw-blob` is more suitable.
 * @returns
 */
export async function decodeWav<M extends keyof WaveCodingModeMap>(
    blob: Blob,
    mode: M,
): Promise<WaveFile<WaveCodingModeMap[M]>> {
    const file = await riff.decodeRiff(blob, riff.wave.waveCodec);
    const format = file.content.find(c => c.id == "fmt ");
    const raw = file.content.find(c => c.id == "data");
    if (!format) throw new Error(`Missing 'fmt ' chunk in provided .wav file`);
    if (!raw) throw new Error(`Missing 'data' chunk in provided .wav file`);

    const infoChunk = file.content.find(c => c.id == "LIST" && c.type == "INFO") as riff.wave.WaveListChunk;
    let info: TrackInfo | null = infoChunk
        ? {
            ...(infoChunk.entries.ICMT ? { comment: infoChunk.entries.ICMT } : {}),
            ...(infoChunk.entries.IART ? { artist: infoChunk.entries.IART } : {}),
            ...(infoChunk.entries.INAM ? { trackName: infoChunk.entries.INAM } : {}),
            ...(infoChunk.entries.IPRD ? { albumName: infoChunk.entries.IPRD } : {}),
            ...(infoChunk.entries.IPRT ? { albumTrackId: +infoChunk.entries.IPRT } : {}),
            ...(infoChunk.entries.ICRD ? { copyrightDate: infoChunk.entries.ICRD } : {}),
            ...(infoChunk.entries.ISFT ? { software: infoChunk.entries.ISFT } : {})
        }
        : null;

    type Data = WaveCodingModeMap[M];
    let data: WaveCodingModeMap[M];

    switch (mode) {
        case "raw-blob":
            data = raw.data as Data;
            break;
        case "raw-buffer":
        case "channels-fmt":
        case "channels-float32": {
            const buffer = raw.data instanceof ArrayBuffer
                ? raw.data
                : "buffer" in raw.data
                ? raw.data.buffer
                : raw.data instanceof Blob
                ? await raw.data.arrayBuffer()
                : await new Blob([raw.data]).arrayBuffer();
            const samples = buffer.byteLength / (format.bitsPerChannel * format.channels / 8);

            switch (mode) {
                case "raw-buffer":
                    data = buffer as Data;
                    break;
                case "channels-fmt": {
                    const dtype = dtypes[format.audioFormat][format.bitsPerChannel];
                    if (dtype == null) throw new Error(`Unsupported bits per channel: ${format.bitsPerChannel}`);
                    const ArrayType = dtype[0];
                    const content = new ArrayType(buffer);
                    const channels = new Array(format.channels).fill(null).map(() => new ArrayType(samples));

                    for (let i = 0; i < samples; i++) {
                        for (let ch = 0; ch < format.channels; ch++) {
                            channels[ch][i] = content[i * format.channels + ch];
                        }
                    }

                    data = channels as unknown as Data;
                    break;
                }
                case "channels-float32": {
                    const dtype = dtypes[format.audioFormat][format.bitsPerChannel];
                    const ArrayTypeOut = mode == "channels-float32" ? Float32Array : null;
                    if (ArrayTypeOut == null) throw new Error(`Unexpected error`);
                    if (dtype == null) throw new Error(`Unsupported bits per channel: ${format.bitsPerChannel}`);
                    const ArrayType = dtype[0];
                    const rawMin = dtype[1] as number;
                    const rawMax = dtype[2] as number;
                    const content = new ArrayType(buffer);
                    const channels = new Array(format.channels).fill(null).map(() => new ArrayTypeOut(samples));

                    for (let i = 0; i < samples; i++) {
                        for (let ch = 0; ch < format.channels; ch++) {
                            const v = content[i * format.channels + ch];
                            channels[ch][i] = ((v - rawMin) / (rawMax - rawMin)) * 2 - 1;
                        }
                    }

                    data = channels as Data;
                    break;
                }
                default:
                    throw new Error(`Unexpected error`);
            }
            break;
        }
        default:
            throw new Error(`Unknown output mode: ${mode}`);
    }

    return { format, info, data };
}
