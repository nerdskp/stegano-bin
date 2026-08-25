const LENGTH_HEADER_BYTES = 4;
const BITS_PER_COLOR_CHANNEL = 2;
const COLOR_CHANNELS_PER_PIXEL = 3;
const RGBA_STRIDE = 4;
const TWO_BIT_MASK = 0b11;
const CLEAR_TWO_LSBS_MASK = 0b11111100;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export class StegoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StegoError";
  }
}

export function getLSBCapacityBytes(imageData: ImageData): number {
  const pixels = imageData.data.length / RGBA_STRIDE;
  const writableBits = pixels * COLOR_CHANNELS_PER_PIXEL * BITS_PER_COLOR_CHANNEL;

  return Math.floor(writableBits / 8) - LENGTH_HEADER_BYTES;
}

function getTotalCapacityBytes(imageData: ImageData): number {
  const pixels = imageData.data.length / RGBA_STRIDE;
  const writableBits = pixels * COLOR_CHANNELS_PER_PIXEL * BITS_PER_COLOR_CHANNEL;

  return Math.floor(writableBits / 8);
}

function assertImageData(imageData: ImageData): void {
  if (!imageData || !(imageData.data instanceof Uint8ClampedArray)) {
    throw new StegoError("A valid ImageData object is required.");
  }

  if (imageData.data.length % RGBA_STRIDE !== 0) {
    throw new StegoError("ImageData buffer length must be divisible by 4.");
  }
}

function buildPayloadBytes(payload: string): Uint8Array {
  if (typeof payload !== "string") {
    throw new StegoError("Payload must be a string.");
  }

  const body = textEncoder.encode(payload);
  if (body.length > 0xffffffff) {
    throw new StegoError("Payload is too large to encode with a 4-byte header.");
  }

  const bytes = new Uint8Array(LENGTH_HEADER_BYTES + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, body.length, false);
  bytes.set(body, LENGTH_HEADER_BYTES);

  return bytes;
}

function readByteFromChannels(
  data: Uint8ClampedArray,
  startChannel: number,
): { byte: number; nextChannel: number } {
  let value = 0;
  let channel = startChannel;

  for (let chunk = 0; chunk < 4; chunk += 1) {
    while (channel % RGBA_STRIDE === 3) {
      channel += 1;
    }

    /*
     * Each RGB channel carries 2 payload bits in its least significant bits.
     * Masking with 0b11 keeps only those final two bits. Shifting the current
     * byte left by 2 opens room for the next two-bit chunk.
     */
    value = (value << BITS_PER_COLOR_CHANNEL) | (data[channel] & TWO_BIT_MASK);
    channel += 1;
  }

  return { byte: value, nextChannel: channel };
}

/**
 * Encodes a UTF-8 string into the 2 least significant bits of each RGB channel.
 *
 * Alpha values are never modified. The first 4 encoded bytes store the payload
 * byte length in big-endian order so decodeLSB can stop at the right point.
 */
export function encodeLSB(imageData: ImageData, payload: string): ImageData {
  assertImageData(imageData);

  const payloadBytes = buildPayloadBytes(payload);
  const capacityBytes = getTotalCapacityBytes(imageData);

  if (payloadBytes.length > capacityBytes) {
    throw new StegoError(
      `Payload requires ${payloadBytes.length} bytes, but image can only store ${capacityBytes} bytes.`,
    );
  }

  const outputData = new Uint8ClampedArray(imageData.data);
  let channelIndex = 0;

  for (let byteIndex = 0; byteIndex < payloadBytes.length; byteIndex += 1) {
    const byte = payloadBytes[byteIndex];

    for (let shift = 6; shift >= 0; shift -= BITS_PER_COLOR_CHANNEL) {
      while (channelIndex % RGBA_STRIDE === 3) {
        channelIndex += 1;
      }

      /*
       * `(byte >> shift) & 0b11` selects the next 2 bits from the payload byte,
       * starting from the most significant pair. `channel & 0b11111100` clears
       * the image channel's existing 2 least significant bits. OR-ing the two
       * values writes the payload bits while preserving the channel's top 6 bits.
       */
      const twoBits = (byte >> shift) & TWO_BIT_MASK;
      outputData[channelIndex] =
        (outputData[channelIndex] & CLEAR_TWO_LSBS_MASK) | twoBits;

      channelIndex += 1;
    }
  }

  // Force alpha to 255 for all pixels to prevent premultiplied alpha rounding during canvas export
  for (let i = 3; i < outputData.length; i += RGBA_STRIDE) {
    outputData[i] = 255;
  }

  return new ImageData(outputData, imageData.width, imageData.height);
}

/**
 * Decodes a UTF-8 string previously written by encodeLSB.
 */
export function decodeLSB(imageData: ImageData): string {
  assertImageData(imageData);

  const capacityBytes = getTotalCapacityBytes(imageData);
  if (capacityBytes < LENGTH_HEADER_BYTES) {
    throw new StegoError("Image does not have enough capacity for a payload header.");
  }

  const data = imageData.data;
  const header = new Uint8Array(LENGTH_HEADER_BYTES);
  let channelIndex = 0;

  for (let index = 0; index < LENGTH_HEADER_BYTES; index += 1) {
    const result = readByteFromChannels(data, channelIndex);
    header[index] = result.byte;
    channelIndex = result.nextChannel;
  }

  const payloadLength = new DataView(header.buffer).getUint32(0, false);
  const totalBytes = LENGTH_HEADER_BYTES + payloadLength;

  if (totalBytes > capacityBytes) {
    throw new StegoError(
      "Encoded payload length exceeds this image's storage capacity.",
    );
  }

  const payloadBytes = new Uint8Array(payloadLength);
  for (let index = 0; index < payloadLength; index += 1) {
    const result = readByteFromChannels(data, channelIndex);
    payloadBytes[index] = result.byte;
    channelIndex = result.nextChannel;
  }

  try {
    return textDecoder.decode(payloadBytes);
  } catch {
    throw new StegoError("Decoded payload is not valid UTF-8 text.");
  }
}

