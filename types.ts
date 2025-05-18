import type * as riff from "./riff/mod.ts";

export type WaveFormat = Omit<riff.wave.WaveFormatChunk, "id">;

export interface WaveFile<T> {
    format: WaveFormat;
    info: TrackInfo | null;
    data: T;
}

export interface TrackInfo {
    comment?: string;
    artist?: string;
    copyrightDate?: string;
    trackName?: string;
    albumName?: string;
    albumTrackId?: number;
    software?: string;
}

export interface WaveCodingModeMap {
    /**
     * Copy blob data as-is to `data` chunk of `.wav` file.
     */
    "raw-blob": Blob;

    /**
     * Copy array buffer bytes as-is to `data` chunk of `.wav` file.
     */
    "raw-buffer": ArrayBuffer;

    /**
     * Encode/decode array of audio channels, each being `Uint8` (notice 8-bit is the only unsigned one here), `Int16`,
     * `Int32`, `Float16`, `Float32` and `Float64` typed array, depending on the audio data format and bits per channel
     * properties in `format`.
     */
    "channels-fmt": ArrayBufferView[];

    /**
     * Encode/decode array of `Float32Array`. This mode is meant to be used with `AudioBuffer`.
     */
    "channels-float32": Float32Array[];
}