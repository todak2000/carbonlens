self.onmessage = (e: MessageEvent) => {
  const { params } = e.data
  const result = {
    storageCapacity: params.area * params.thickness * params.porosity * 0.6 * 800 / 1e9,
    plumeRadius: Math.sqrt(params.area * 1e6 / Math.PI) * 0.3,
    injectionPressure: params.pressure + 2.5,
    co2Density: 700,
    solubilityTrapping: 0,
    residualTrapping: 0,
    mobilePlume: 0,
    containmentProbability: 0.7,
    ift: null,
    p10: 0, p50: 0, p90: 0,
  }
  self.postMessage({ result })
}

export {}
