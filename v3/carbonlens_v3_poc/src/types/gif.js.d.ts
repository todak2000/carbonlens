declare module 'gif.js' {
  interface GIFOptions {
    repeat?: number
    quality?: number
    workers?: number
    width?: number
    height?: number
    background?: string
    transparent?: string | null
    dither?: boolean
    debug?: boolean
    workerScript?: string
    globalPalette?: boolean
  }

  interface AddFrameOptions {
    delay?: number
    copy?: boolean
  }

  class GIF {
    constructor(options?: GIFOptions)
    addFrame(
      image:
        | HTMLCanvasElement
        | CanvasRenderingContext2D
        | WebGLRenderingContext
        | ImageData
        | HTMLImageElement,
      options?: AddFrameOptions,
    ): void
    on(event: 'finished', handler: (blob: Blob, data: Uint8Array) => void): void
    on(event: 'progress', handler: (progress: number) => void): void
    on(event: 'start', handler: () => void): void
    on(event: 'abort', handler: () => void): void
    render(): void
    abort(): void
    running: boolean
    frames: any[]
    options: GIFOptions
  }

  export default GIF
}
