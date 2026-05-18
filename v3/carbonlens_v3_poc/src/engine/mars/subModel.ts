import { MarsEquation, FeatureScaler, MarsInput } from './types'

export const subEquation: MarsEquation = {
  intercept: 51.6235553861666,
  terms: [
    { coefficient: 17.9632022914057, hinges: [{ feature: 'drho_sq', direction: 1, knot: 0.0281806109800826 }] },
    { coefficient: 275.258598962578, hinges: [{ feature: 'drho_sq', direction: -1, knot: 0.0281806109800826 }] },
    { coefficient: 26.5843576382842, hinges: [{ feature: 'Pr', direction: 1, knot: -0.719795157882769 }] },
    { coefficient: 26.1380302891754, hinges: [{ feature: 'Pr', direction: -1, knot: -0.719795157882769 }] },
    { coefficient: -20.2104589314737, hinges: [{ feature: 'Tr', direction: 1, knot: -0.395581427707493 }] },
    { coefficient: 12.7759944240297, hinges: [{ feature: 'Tr', direction: -1, knot: -0.395581427707493 }] },
    { coefficient: -51.1174125461729, hinges: [{ feature: 'Pr', direction: -1, knot: -0.719795157882769 }, { feature: 'Tr', direction: 1, knot: -0.517979343182176 }] },
    { coefficient: 137.846453076672, hinges: [{ feature: 'Pr', direction: -1, knot: -0.719795157882769 }, { feature: 'Tr', direction: -1, knot: -0.517979343182176 }] },
    { coefficient: -55.2389048217634, hinges: [{ feature: 'Pr', direction: 1, knot: -0.719795157882769 }, { feature: 'drho_sq', direction: 1, knot: -0.703864147663175 }] },
    { coefficient: -97.8475476858418, hinges: [{ feature: 'Pr', direction: 1, knot: -0.719795157882769 }, { feature: 'drho_sq', direction: -1, knot: -0.703864147663175 }] },
    { coefficient: 66.6219108711941, hinges: [{ feature: 'Tr', direction: 1, knot: -0.515960408493934 }, { feature: 'drho_sq', direction: 1, knot: 0.0281806109800826 }] },
    { coefficient: 283.624201339582, hinges: [{ feature: 'drho_sq', direction: -1, knot: 0.0281806109800826 }, { feature: 'CH4_bin', direction: 2, knot: -1 }] },
    { coefficient: -499.801564581002, hinges: [{ feature: 'Tr', direction: 1, knot: -0.897791431407739 }, { feature: 'drho_sq', direction: -1, knot: 0.0281806109800826 }] },
    { coefficient: -45.0736063858785, hinges: [{ feature: 'Tr', direction: -1, knot: -0.897791431407739 }, { feature: 'drho_sq', direction: -1, knot: 0.0281806109800826 }] },
    { coefficient: 38.3241286484432, hinges: [{ feature: 'Tr', direction: -1, knot: -0.395581427707493 }, { feature: 'x_CH4', direction: 2, knot: -1 }] },
  ],
}

export const subScaler: FeatureScaler = {
  feature_cols: ['Pr', 'Tr', 'MCM', 'BCM', 'x_CH4', 'x_N2', 'drho_sq', 'BCM_bin', 'CH4_bin', 'N2_bin'],
  scale_min: -1,
  scale_max: 1,
  params: {
    Pr: { min: 0.013550135501355, max: 4.694600993224932 },
    Tr: { min: 0.91494675956356, max: 2.2171965898227066 },
    MCM: { min: 0, max: 4.9 },
    BCM: { min: 0, max: 1.5 },
    x_CH4: { min: 0, max: 89 },
    x_N2: { min: 0, max: 76.36 },
    drho_sq: { min: 0.0001323598954303, max: 1.294887038140309 },
    BCM_bin: { min: 0, max: 1 },
    CH4_bin: { min: 0, max: 1 },
    N2_bin: { min: 0, max: 1 },
  },
}
