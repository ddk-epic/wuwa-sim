import { describe, expect, it } from "vitest"
import { decode, encode } from "./base91"

describe("base91 encode/decode roundtrip", () => {
  it("roundtrips empty input", () => {
    const data = new Uint8Array(0)
    expect(decode(encode(data))).toEqual(data)
  })

  it("roundtrips a single byte", () => {
    for (const byte of [0, 1, 127, 128, 255]) {
      const data = new Uint8Array([byte])
      expect(decode(encode(data))).toEqual(data)
    }
  })

  it("roundtrips a known sequence", () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    expect(decode(encode(data))).toEqual(data)
  })

  it("roundtrips 256 bytes with all values", () => {
    const data = new Uint8Array(256)
    for (let i = 0; i < 256; i++) data[i] = i
    expect(decode(encode(data))).toEqual(data)
  })

  it("produces only printable ASCII characters", () => {
    const data = new Uint8Array(64)
    crypto.getRandomValues(data)
    const encoded = encode(data)
    for (const ch of encoded) {
      const code = ch.charCodeAt(0)
      expect(code).toBeGreaterThanOrEqual(33)
      expect(code).toBeLessThanOrEqual(126)
    }
  })
})
