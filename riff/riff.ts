/**
 * The RIFF file header (`RIFF`).
 */
export const riff = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

/**
 * Represent RIFF file.
 */
export interface RiffFile<T extends RiffChunk> {
    /**
     * The type of RIFF file, which is `WAVE` for `.wav` files.
     */
    type: string;

    /**
     * The content of the RIFF file.
     */
    content: T[];

    /**
     * A list of unknown RIFF chunks.
     */
    unknowns: UnknownRiffChunk[];
}

/**
 * Represent RIFF chunk. Each chunk in RIFF consists of chunk header, chunk size and content of that chunk. Chunks are
 * normally aligned.
 */
export interface RiffChunk {
    id: string;
}

/**
 * Represent unknown RIFF chunk.
 */
export interface UnknownRiffChunk {
    id: string;
    data: BlobPart;
}

/**
 * Represent a codec for encoding or decoding a particular RIFF chunk.
 */
export interface RiffChunkCodec<T extends RiffChunk> {
    encode(data: T): Promise<Blob>;
    decode(blob: Blob): Promise<T>;
}

/**
 * Utility type for extracting RIFF chunk type from ID string.
 */
export type ExtractChunkType<T extends RiffChunk, I extends string> = T["id"] extends I ? T : never;

/**
 * A record of `RiffChunkCodec<T>`, each associate with variant of `id` property.
 */
export type RiffChunkCodecs<T extends RiffChunk> = { [x in T["id"]]: RiffChunkCodec<T> };

/**
 * RIFF decoding options.
 */
export interface RiffDecodeOptions {
    /**
     * Validate the header to ensure it is valid. Default is `true`.
     */
    validateHeader?: boolean;
}

/**
 * Decode RIFF file.
 * @param blob Content of the RIFF.
 * @param codecs Codecs to decode RIFF chunks.
 * @param param2 Decoding options.
 * @returns `RiffFile` with known chunks decoded.
 */
export async function decodeRiff<T extends RiffChunk>(
    blob: Blob,
    codecs?: RiffChunkCodecs<T>,
    {
        validateHeader = true,
    }: RiffDecodeOptions = {},
): Promise<RiffFile<T>> {
    if (validateHeader) {
        const fileRiff = new Uint8Array(await blob.slice(0, riff.length).arrayBuffer());

        for (let i = 0; i < riff.length; i++) {
            if (riff[i] != fileRiff[i]) {
                throw new Error(
                    `Invalid RIFF header (expecting file[${i}] == 0x${
                        riff[i].toString(16).padStart(2, "0")
                    }, but found 0x${fileRiff[i].toString(16).padStart(2, "0")})`,
                );
            }
        }
    }

    const [size] = new Uint32Array(await blob.slice(4, 8).arrayBuffer());
    const type = await blob.slice(8, 12).text();
    const contentRaw = blob.slice(12, size + 8);
    const content: T[] = [];
    const unknowns: UnknownRiffChunk[] = [];
    let pointer = 0;
    
    while (pointer < contentRaw.size) {
        const id = await contentRaw.slice(pointer, pointer + 4).text();
        const [subchunkSize] = new Uint32Array(await contentRaw.slice(pointer + 4, pointer + 8).arrayBuffer());
        const subchunkRaw = contentRaw.slice(pointer + 8, pointer + 8 + subchunkSize);
        pointer += subchunkSize + 8;
        
        const codec = (codecs as Record<string, RiffChunkCodec<RiffChunk> | undefined>)?.[id];

        if (codec) {
            const data = await codec.decode(subchunkRaw);
            content.push(data as T);
        } else {
            unknowns.push({ id, data: subchunkRaw });
        }
    }

    return { type, content, unknowns };
}

/**
 * Encode RIFF file.
 * @param file `RiffFile`.
 * @param codecs Codecs to encode known RIFF chunks.
 * @returns A `Blob`.
 */
export async function encodeRiff<T extends RiffChunk = UnknownRiffChunk>(
    file: RiffFile<T>,
    codecs?: RiffChunkCodecs<T>
): Promise<Blob> {
    if (file.type.length != 4) throw new Error(`RIFF type must have a length of 4 (found '${file.type}')`);
    const parts: BlobPart[] = [file.type];

    for (const chunkData of file.content) {
        if (chunkData.id.length != 4) throw new Error(`Chunk ID must have a length of 4 (found '${chunkData.id}')`);
        const codec = (codecs as Record<string, RiffChunkCodec<RiffChunk> | undefined>)?.[chunkData.id];
        if (!codec) throw new Error(`No chunk codec for '${chunkData.id}'`);
        const chunk = await codec.encode(chunkData);
        parts.push(chunkData.id, new Uint32Array([chunk.size]), chunk);
    }

    for (const { id, data } of file.unknowns) {
        const size = data instanceof Blob
            ? data.size
            : typeof data == "string" ? new Blob([data]).size
            : data.byteLength;
        parts.push(id, new Uint32Array([size]), data);
    }

    const contentBlob = new Blob(parts);
    return new Blob([riff, new Uint32Array([contentBlob.size]), contentBlob]);
}