declare module "base91" {
  function encode(data: Uint8Array | Buffer): string
  function decode(data: string): Buffer
}
