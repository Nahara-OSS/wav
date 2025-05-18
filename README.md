# Nahara's WAV Encoder
`.wav` file encoder and decoder. Meant to be used with `AudioBuffer`, but can also be used on server-side environment.

## Example
```typescript
import { encodeWav, decodeWav, WaveAudioFormat } from "jsr:@nahara/wav";

// Decoding to Float32Array[]
const file = new Blob(await Deno.readFile("path/to/file.wav"));
const wav = decodeWav(file, "channels-float32");
console.log(wav.format.sampleRate);

// Processing - Add some white noise
const channels = wav.data.length;
const samples = wav.data[0].length;

for (let ch = 0; ch < channels; ch++) {
    for (let sample = 0; sample < samples; sample++) {
        channels[ch][sample] += Math.random() * 0.1 - 0.05;
    }
}

// Alter output format to PCM 16-bit
wav.format.audioFormat = WaveAudioFormat.PCM;
wav.format.bitsPerChannel = 16;

// Encoding from Float32Array[]
const outputFile = encodeWav(wav, "channels-float32");
```

Also check out [example/audiobuffer.ts](example/audiobuffer.ts) for example on encoding and decoding between `.wav` and
`AudioBuffer`.

## License
MIT License.