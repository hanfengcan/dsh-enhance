/**
 * Zstandard frames of a dsh Session log.
 *
 * A dsh Session log is a container of concatenated Zstandard frames — one frame
 * per durable append — so a reader has to find the frame boundaries before it
 * can decode anything.
 *
 * The frames are decoded one at a time with Node's own zlib, which runs the
 * decompression off the event loop: a long log no longer keeps the Host busy
 * while it unpacks, and the caller can cancel between two frames.
 * @module dsh-enhance/session-unpack/frames
 */

import { zstdDecompress } from 'node:zlib'
import { promisify } from 'node:util'

/** Magic number every Zstandard frame starts with. */
const ZSTD_MAGIC = 0xFD2FB528

/** The asynchronous form of zlib's Zstandard decompress. */
const zstdDecompressAsync = promisify(zstdDecompress)

/**
 * Locate every structurally complete Zstandard frame in a concatenated stream.
 * The frame header states its own layout, and each block header states its own
 * size, so the boundaries can be walked without decompressing anything.
 * @param buffer - the concatenated frame bytes.
 * @returns the byte range of every complete frame, in file order.
 */
export function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`not a Zstandard frame: wrong magic at byte ${offset}`)
    }
    offset += 4
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) {
      throw new Error(`not a Zstandard frame: reserved header bit at byte ${offset - 1}`)
    }
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    for (;;) {
      if (buffer.length - offset < 3) break
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) throw new Error(`not a Zstandard frame: reserved block type at byte ${offset - 3}`)
      offset += blockType === 0x01 ? 1 : blockSize
      if (lastBlock) break
    }
    if (checksum) offset += 4
    frames.push({ start, end: offset })
  }
  return frames
}

/**
 * Decode a concatenated Zstandard stream into its plaintext.
 *
 * Every frame is decompressed on its own, off the event loop, and the signal is
 * checked between two frames: an aborted call stops before the next frame is
 * touched. One frame is decompressed as a whole, so a call cannot be cancelled
 * inside a single frame.
 * @param buffer - the concatenated frame bytes.
 * @param signal - the cancellation signal of the running call.
 * @returns the decoded bytes of every frame, in order.
 */
export async function decodeZstdFrames(buffer, signal) {
  const frames = scanZstdFrames(buffer)
  const chunks = []
  for (const frame of frames) {
    signal?.throwIfAborted()
    chunks.push(await zstdDecompressAsync(buffer.subarray(frame.start, frame.end)))
  }
  return Buffer.concat(chunks)
}
