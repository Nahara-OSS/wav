import { encodeWav, decodeWav, WaveAudioFormat } from "../mod.ts";

export async function encodeFromAudioBuffer(buffer: AudioBuffer, bitsPerChannel: number = 16): Promise<Blob> {
    const { sampleRate, numberOfChannels } = buffer;
    const data = new Array<Float32Array>(2);
    for (let channel = 0; channel < numberOfChannels; channel++) data[channel] = buffer.getChannelData(channel);
    return await encodeWav({
        format: {
            audioFormat: WaveAudioFormat.PCM,
            channels: numberOfChannels,
            bitsPerChannel,
            sampleRate,
            blockAlign: numberOfChannels * bitsPerChannel / 8,
            byteRate: sampleRate * numberOfChannels * bitsPerChannel / 8
        },
        info: {
            software: "Nahara's WAV Encoder"
        },
        data
    }, "channels-float32");
}

export async function decodeToAudioBuffer(file: Blob): Promise<AudioBuffer> {
    const { format: { sampleRate, channels: numberOfChannels }, data } = await decodeWav(file, "channels-float32");
    const length = data[0].length;
    const buffer = new AudioBuffer({ sampleRate, length, numberOfChannels });
    for (let channel = 0; channel < numberOfChannels; channel++) buffer.copyToChannel(data[channel], channel);
    return buffer;
}