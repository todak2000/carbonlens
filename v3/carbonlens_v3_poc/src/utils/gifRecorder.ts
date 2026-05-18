import GIF from 'gif.js'

export function recordFramesToGif(frames: string[], delayMs = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (frames.length === 0) return reject(new Error('No frames to encode'))

    let width = 0
    let height = 0
    let loaded = 0

    // Load first frame to get dimensions, then create GIF
    const tmp = new Image()
    tmp.onload = () => {
      width = tmp.naturalWidth
      height = tmp.naturalHeight

      const gif = new GIF({
        workers: Math.min(2, navigator.hardwareConcurrency || 2),
        quality: 10,
        width,
        height,
        workerScript: '/gif.worker.js',
        repeat: 0,
        background: '#0a1015',
        transparent: null,
      })

      // Add all frames
      for (const dataUrl of frames) {
        const img = new Image()
        img.onload = () => {
          gif.addFrame(img, { delay: delayMs, copy: true })
          loaded++
          if (loaded === frames.length) {
            gif.on('finished', (blob) => resolve(blob))
            gif.on('abort', () => reject(new Error('GIF encoding aborted')))
            gif.render()
          }
        }
        img.onerror = () => reject(new Error('Failed to load frame image'))
        img.src = dataUrl
      }
    }
    tmp.onerror = () => reject(new Error('Failed to load first frame'))
    tmp.src = frames[0]
  })
}
