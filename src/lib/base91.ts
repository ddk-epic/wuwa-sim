const ENCODING_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"'

const DECODING_TABLE = new Uint8Array(256).fill(91)
for (let i = 0; i < ENCODING_TABLE.length; i++) {
  DECODING_TABLE[ENCODING_TABLE.charCodeAt(i)] = i
}

export function encode(data: Uint8Array): string {
  let ebq = 0
  let en = 0
  let output = ""

  for (const byte of data) {
    ebq |= (byte & 0xff) << en
    en += 8
    if (en > 13) {
      let ev = ebq & 8191
      if (ev > 88) {
        ebq >>= 13
        en -= 13
      } else {
        ev = ebq & 16383
        ebq >>= 14
        en -= 14
      }
      output += ENCODING_TABLE[ev % 91] + ENCODING_TABLE[(ev / 91) | 0]
    }
  }

  if (en > 0) {
    output += ENCODING_TABLE[ebq % 91]
    if (en > 7 || ebq > 90) output += ENCODING_TABLE[(ebq / 91) | 0]
  }

  return output
}

export function decode(data: string): Uint8Array {
  // Allocate data.length as a safe upper bound; decoded output is always shorter.
  const output = new Uint8Array(data.length)
  let dbq = 0
  let dn = 0
  let dv = -1
  let o = -1

  for (let i = 0; i < data.length; i++) {
    const t = DECODING_TABLE[data.charCodeAt(i)]
    if (t === 91) continue
    if (dv === -1) {
      dv = t
    } else {
      dv += t * 91
      dbq |= dv << dn
      dn += (dv & 8191) > 88 ? 13 : 14
      do {
        output[++o] = dbq & 0xff
        dbq >>= 8
        dn -= 8
      } while (dn > 7)
      dv = -1
    }
  }

  if (dv !== -1) output[++o] = (dbq | (dv << dn)) & 0xff

  return output.subarray(0, o + 1)
}
