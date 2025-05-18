import * as riff from "./riff/mod.ts";

type TypedArray =
    | Uint8Array
    | Int16Array
    | Int32Array
    | Float16Array
    | Float32Array
    | Float64Array;

interface TypedArrayConstructor {
    new (length: number): TypedArray;
    new (buffer: ArrayBufferLike): TypedArray;
};

type DtypeEntry = [TypedArrayConstructor, number, number];

export const dtypes: Record<riff.wave.WaveAudioFormat, Record<number, DtypeEntry | null>> = {
    [riff.wave.WaveAudioFormat.PCM]: {
        8: [Uint8Array, 0, 255],
        16: [Int16Array, -32768, 32767],
        32: [Int32Array, 0x80000000 | 0, 0x7FFFFFFF],
    },
    [riff.wave.WaveAudioFormat.Floats]: {
        16: [Float16Array, -1, 1],
        32: [Float32Array, -1, 1],
        64: [Float64Array, -1, 1],
    },
};