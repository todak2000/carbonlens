export interface UnitSystem {
  label: string
  depth: string
  pressure: string
  temperature: string
  salinity: string
  area: string
  rate: string
  capacity: string
  density: string
  viscosity: string
  ift: string
}

export const METRIC: UnitSystem = {
  label: 'Metric',
  depth: 'm',
  pressure: 'MPa',
  temperature: '°C',
  salinity: 'mol/kg',
  area: 'km²',
  rate: 'Mt/yr',
  capacity: 'Mt',
  density: 'kg/m³',
  viscosity: 'μPa·s',
  ift: 'mN/m',
}

export const IMPERIAL: UnitSystem = {
  label: 'Imperial',
  depth: 'ft',
  pressure: 'psi',
  temperature: '°F',
  salinity: 'mol/kg',
  area: 'mi²',
  rate: 'MMscf/d',
  capacity: 'Bscf',
  density: 'lb/ft³',
  viscosity: 'cP',
  ift: 'dyn/cm',
}
