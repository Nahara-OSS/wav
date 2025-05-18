/**
 * `.wav` RIFF chunks encoders and decoders.
 * 
 * @module
 */

import type { RiffChunk, RiffChunkCodec, RiffChunkCodecs } from "./riff.ts";

export enum WaveAudioFormat {
    // Unknown = 0x00,
    /**
     * Uncompressed PCM data. Audio samples are quantized into integers. Supports `Uint8Array`, `Int16Array` and
     * `Int32Array`.
     */
    PCM = 0x01,
    // AdaptivePCM = 0x02,
    /**
     * Uncompressed floating point sample data. Each sample is a IEEE 754 float number. Supports `Float16Array`,
     * `Float32Array` and `Float64Array`.
     */
    Floats = 0x03,
}

/**
 * The `fmt ` chunk of `.wav` file. This chunk describe how the `data` chunk should be interpreted.
 */
export interface WaveFormatChunk extends RiffChunk {
    id: "fmt ";

    /**
     * Audio data format. Currently support 8-bit, 16-bit and 32-bit PCM; 16-bit, 32-bit and 64-bit floats. 64-bit PCM
     * data is not supported due to forced usage of `bigint`, which may not optimal unless we use WebAssembly for
     * processing. Compressed formats are also not supported at this moment.
     */
    audioFormat: WaveAudioFormat;

    /**
     * Number of audio channels.
     */
    channels: number;

    /**
     * Number of samples per second. Typically `44100` for CD quality, sometimes even `48000`. Lower values are also
     * possible, but generally it should be double the maximum frequency (an average human can hear up to 20kHz, which
     * is why the sample rate is usually 44100kHz).
     */
    sampleRate: number;

    /**
     * Average number of bytes per second. For uncompressed PCM data, this is `bps * channels * sampleRate / 8`.
     */
    byteRate: number;

    /**
     * Number of bytes for each block. A block consists of samples for each channel. For example, if the `.wav` file
     * format is PCM 16-bit 2 channels, a single block have a size of 4 bytes (16 bits for sample * 2 channels, divide
     * by 8 bits).
     */
    blockAlign: number;

    /**
     * Number of bits per channel. Typical value is `16` (for 16-bit integers for each sample).
     */
    bitsPerChannel: number;
}

/**
 * Codec for encoding or decoding `fmt ` chunk.
 */
export const fmt: RiffChunkCodec<WaveFormatChunk> = {
    async decode(blob) {
        const [formatId, channels] = new Uint16Array(await blob.slice(0, 4).arrayBuffer());
        const audioFormat = formatId as WaveAudioFormat;

        switch (audioFormat) {
            case WaveAudioFormat.PCM:
            case WaveAudioFormat.Floats:
                break;
            default:
                throw new Error(`Unsupported audio data format: 0x${formatId.toString(16).padStart(2, "0")}`);
        }

        const [sampleRate, byteRate] = new Uint32Array(await blob.slice(4, 12).arrayBuffer());
        const [blockAlign, bitsPerChannel] = new Uint16Array(await blob.slice(12, 16).arrayBuffer());
        return {
            id: "fmt ",
            audioFormat,
            channels,
            sampleRate,
            byteRate,
            blockAlign,
            bitsPerChannel
        };
    },
    encode({ audioFormat, channels, sampleRate, byteRate, blockAlign, bitsPerChannel }) {
        return Promise.resolve(new Blob([
            new Uint16Array([audioFormat, channels]),
            new Uint32Array([sampleRate, byteRate]),
            new Uint16Array([blockAlign, bitsPerChannel]),
        ]));
    },
};

export interface WaveListChunk extends RiffChunk {
    id: "LIST";
    type: string;
    entries: WaveListEntries;
}

export interface WaveListEntries {
    /**
     * Artist's name.
     */
    "IART"?: string;

    /**
     * Additional comment.
     */
    "ICMT"?: string;

    /**
     * Copyright date, usually just a year number.
     */
    "ICRD"?: string;

    /**
     * Track title.
     */
    "INAM"?: string;

    /**
     * Album title.
     */
    "IPRD"?: string;

    /**
     * Track's album number.
     */
    "IPRT"?: string;

    /**
     * Software used to encode the file.
     */
    "ISFT"?: string;
    [x: string]: string | undefined;
}

/**
 * Codec for encoding or decoding `LIST` chunk.
 */
export const list: RiffChunkCodec<WaveListChunk> = {
    async decode(blob) {
        const type = await blob.slice(0, 4).text();
        const entries: WaveListEntries = {};
        let pointer = 4;

        while (pointer < blob.size) {
            const name = await blob.slice(pointer, pointer + 4).text();
            const [size] = new Uint32Array(await blob.slice(pointer + 4, pointer + 8).arrayBuffer());
            const value = await blob.slice(pointer + 8, pointer + 8 + size - 1).text(); // Always ends with 0x00
            entries[name] = value;
            await new Promise(r => setTimeout(r, 100));
            pointer += 8 + (((size + 1) >> 1) << 1);
        }

        return { id: "LIST", type, entries };
    },
    encode({ type, entries }) {
        const parts: BlobPart[] = [type];
        const encoder = new TextEncoder();

        for (const name in entries) {
            if (!entries[name]) continue;
            if (name.length != 4) throw new Error(`Entry name must have a length of 4 (found '${name}')`);
            const encoded = encoder.encode(entries[name]);
            const size = encoded.length + 1;
            const tail = new Uint8Array(1 + (size % 2 == 0 ? 0 : 2 - (size % 2)));
            parts.push(name, new Uint32Array([size]), encoded, tail);
        }

        return Promise.resolve(new Blob(parts));
    },
};

export interface WaveDataChunk extends RiffChunk {
    id: "data";
    data: Blob | ArrayBuffer | ArrayBufferView;
}

/**
 * Passthrough codec for encoding or decoding `data` chunk.
 */
export const data: RiffChunkCodec<WaveDataChunk> = {
    decode(blob) {
        return Promise.resolve({ id: "data", data: blob });
    },
    encode({ data }) {
        return Promise.resolve(data instanceof Blob ? data : new Blob([data]));
    },
};

export type WaveRiffChunk =
    | WaveFormatChunk
    | WaveListChunk
    | WaveDataChunk;

/**
 * A record of codecs for decoding chunks in `.wav` file.
 */
export const waveCodec: RiffChunkCodecs<WaveRiffChunk> = {
    "fmt ": fmt,
    "LIST": list,
    "data": data
};