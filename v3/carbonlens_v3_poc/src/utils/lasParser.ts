export interface LasData {
  depths: number[]
  curves: Record<string, number[]>
  metadata: string[]
  curveNames: string[]
}

export function parseLAS(text: string): LasData {
  const lines = text.split('\n')
  const meta: string[] = []
  const curveNames: string[] = []
  const curveUnits: string[] = []
  let dataStarted = false
  let depthIdx = -1
  const curveIndices: { name: string; idx: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '').trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('~V') || line.startsWith('~W')) continue
    if (line.startsWith('~C')) {
      dataStarted = false
      continue
    }
    if (line.startsWith('~A') || line.startsWith('~D')) {
      dataStarted = true
      continue
    }
    if (dataStarted) {
      continue
    }
    if (line.startsWith('~')) {
      dataStarted = false
      continue
    }

    const parts = line.split(/\s+/)
    if (curveNames.length === 0 && parts.length >= 2 && parts[0] !== 'STRT' && parts[0] !== 'STOP' && parts[0] !== 'STEP') {
      for (const p of parts) {
        const clean = p.replace(/\.$/, '').replace(/"/g, '')
        if (clean && clean !== ':') {
          curveNames.push(clean)
        }
      }
      continue
    }

    meta.push(line)

    if (line.startsWith('STRT')) meta.push(line)
    else if (line.startsWith('STOP')) meta.push(line)
    else if (line.startsWith('STEP')) meta.push(line)
  }

  const dataLines = lines.filter((l) => {
    const t = l.replace(/\r/g, '').trim()
    if (!t) return false
    const first = t.split(/\s+/)[0]
    return !isNaN(Number(first))
  })

  const depthValues: number[] = []
  const curveValues: Record<string, number[]> = {}
  for (const name of curveNames) {
    if (name !== '' && name !== ':') {
      curveValues[name] = []
    }
  }

  for (const line of dataLines) {
    const nums = line.trim().split(/\s+/).map(Number)
    if (nums.length < 2) continue
    depthValues.push(nums[0])
    for (let j = 1; j < nums.length; j++) {
      if (curveNames[j - 1] && curveValues[curveNames[j - 1]]) {
        curveValues[curveNames[j - 1]].push(nums[j])
      }
    }
  }

  return {
    depths: depthValues,
    curves: curveValues,
    metadata: meta,
    curveNames: Object.keys(curveValues),
  }
}
