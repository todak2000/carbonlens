/**
 * modelRegistry.ts
 * ================
 * Single source of truth for every scientific model, correlation, and
 * numerical method used in CarbonLens.
 *
 * Rules:
 *  - Every model that appears in a report, UI panel, or test must have an entry here.
 *  - When you rename, replace, or add a model, update this file ONLY.
 *    All report generators, the MethodologyPanel, and the CI validator
 *    derive their content from this registry automatically.
 *  - Run `yarn sync:models` after any change to regenerate public/model-registry.json
 *    and inject updated attribution text into static HTML files.
 *  - Run `yarn validate:models` in CI to verify implementedIn paths are real files.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelDomain =
  | 'co2-thermodynamics'
  | 'brine-thermodynamics'
  | 'transport-properties'
  | 'relative-permeability'
  | 'capillary-pressure'
  | 'trapping-mechanisms'
  | 'pressure-solver'
  | 'plume-migration'
  | 'storage-screening'
  | 'geomechanics'
  | 'thermal'
  | 'benchmark-validation'

/** 'classical': peer-reviewed correlation  'ml': machine-learning  'numerical': FD/FEM solver  'empirical': rule-of-thumb / constant */
export type ModelType = 'classical' | 'ml' | 'numerical' | 'empirical'

/** 'active': the deployed default  'alternative': user-selectable / secondary  'stub': coded but incomplete  'deprecated': replaced  'hardcoded-constant': no correlation, constant value used */
export type ModelStatus = 'active' | 'alternative' | 'stub' | 'deprecated' | 'hardcoded-constant'

export interface Citation {
  authors: string
  year: number
  title?: string
  journal?: string
  doi?: string
  note?: string
}

export interface ValidationRef {
  testFile: string     // path relative to src/
  expectedRange: string
}

export interface ChangelogEntry {
  date: string         // ISO date
  description: string
}

export interface ModelEntry {
  /** Unique kebab-case identifier, stable across refactors */
  id: string
  /** Physics domain, typed enum prevents free-text drift */
  domain: ModelDomain
  /** Human-readable property being computed */
  property: string
  /** Full model name as it appears in publications */
  name: string
  /** Short form for inline attribution strings */
  shortName: string
  /** 'classical' | 'ml' | 'numerical' | 'empirical' */
  type: ModelType
  /** Deployment state */
  status: ModelStatus
  /** Structured citation — use renderCitation() to format */
  citation: Citation
  /** Source file path relative to src/ (for CI validation) */
  implementedIn: string
  /** Exported function or class name in that file */
  exportedAs?: string
  /** For alternative/stub: id of the primary model this relates to */
  alternativeTo?: string
  /** Links to test files that benchmark this model */
  validatedAgainst?: ValidationRef[]
  /** One-sentence description of known accuracy limits or gaps */
  knownLimitations?: string
  /** History of model changes */
  changelog?: ChangelogEntry[]
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const MODEL_REGISTRY: ModelEntry[] = [

  // ── CO₂ Thermodynamics ────────────────────────────────────────────────────

  {
    id: 'co2-density-span-wagner',
    domain: 'co2-thermodynamics',
    property: 'CO\u2082 Density',
    name: 'Span-Wagner (1996) Helmholtz EOS',
    shortName: 'Span-Wagner (1996) CO\u2082 EOS',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Span, R. & Wagner, W.',
      year: 1996,
      title: 'A New Equation of State for Carbon Dioxide Covering the Fluid Region from the Triple-Point Temperature to 1100 K at Pressures up to 800 MPa',
      journal: 'J. Phys. Chem. Ref. Data 25(6):1509\u20131596',
      doi: '10.1063/1.555991',
    },
    implementedIn: 'engine/classical/density.ts',
    exportedAs: 'co2DensitySpanWagner',
    validatedAgainst: [
      { testFile: '__tests__/engine/ve/sleipner_data_benchmark.test.ts', expectedRange: '\u00b11.0% vs NIST REFPROP at 37\u00b0C, 10.3 MPa' },
    ],
    knownLimitations: 'Near-critical region (|T\u2212Tc| < 2 K) uses nonanalytic terms; avoid at T < 220 K.',
  },

  {
    id: 'co2-density-peng-robinson',
    domain: 'co2-thermodynamics',
    property: 'CO\u2082 Density (Impure)',
    name: 'Peng-Robinson (1976) EOS with Li & Yan (2009) binary interaction parameters',
    shortName: 'Peng-Robinson (1976) impure CO\u2082',
    type: 'classical',
    status: 'alternative',
    alternativeTo: 'co2-density-span-wagner',
    citation: {
      authors: 'Peng, D.Y. & Robinson, D.B.',
      year: 1976,
      title: 'A New Two-Constant Equation of State',
      journal: 'Ind. Eng. Chem. Fundam. 15(1):59\u201364',
      note: 'k_ij from Li & Yan (2009) J. Supercrit. Fluids 50(2):143\u2013150',
    },
    implementedIn: 'engine/classical/pengrobin.ts',
    exportedAs: 'co2DensityWithImpurities',
    knownLimitations: 'Use only when CO\u2082 stream contains CH\u2084, N\u2082, H\u2082S, or SO\u2082 impurities. Pure CO\u2082: use Span-Wagner.',
  },

  {
    id: 'co2-viscosity-fenghour',
    domain: 'co2-thermodynamics',
    property: 'CO\u2082 Viscosity',
    name: 'Fenghour, Wakeham & Vesovic (1998)',
    shortName: 'Fenghour et al. (1998) CO\u2082 viscosity',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Fenghour, A., Wakeham, W.A. & Vesovic, V.',
      year: 1998,
      title: 'The Viscosity of Carbon Dioxide',
      journal: 'J. Phys. Chem. Ref. Data 27(1):31\u201344',
      doi: '10.1063/1.556013',
    },
    implementedIn: 'engine/classical/viscosity.ts',
    exportedAs: 'co2ViscosityFenghour',
    knownLimitations: '\u00b15\u201310% in the dense supercritical region vs. Laesecke & Muzny (2017); upgrade pending coefficient transcription.',
    changelog: [
      { date: '2026-06-27', description: 'Retained as active; Laesecke & Muzny stub added as planned upgrade.' },
    ],
  },

  {
    id: 'co2-viscosity-laesecke',
    domain: 'co2-thermodynamics',
    property: 'CO\u2082 Viscosity',
    name: 'Laesecke & Muzny (2017) NIST Reference Correlation',
    shortName: 'Laesecke & Muzny (2017)',
    type: 'classical',
    status: 'stub',
    alternativeTo: 'co2-viscosity-fenghour',
    citation: {
      authors: 'Laesecke, A. & Muzny, C.D.',
      year: 2017,
      title: 'Reference Correlation for the Viscosity of Carbon Dioxide',
      journal: 'J. Phys. Chem. Ref. Data 46(1):013107',
      doi: '10.1063/1.4977429',
    },
    implementedIn: 'engine/classical/viscosity.ts',
    exportedAs: 'co2ViscosityLaeseckeMuzny',
    knownLimitations: 'Implementation stub only. Full coefficient table transcription is a planned upgrade. Improves accuracy from \u00b15% to \u00b10.5% in the supercritical region.',
  },

  {
    id: 'co2-phase',
    domain: 'co2-thermodynamics',
    property: 'CO\u2082 Phase State',
    name: 'CO\u2082 critical-point thresholds',
    shortName: 'CO\u2082 phase determination',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'NIST WebBook',
      year: 2023,
      journal: 'NIST Standard Reference Database 69',
      note: 'Tc = 304.13 K, Pc = 7.377 MPa',
    },
    implementedIn: 'engine/classical/phase.ts',
    exportedAs: 'determinePhase',
  },

  // ── Brine Thermodynamics ──────────────────────────────────────────────────

  {
    id: 'brine-density-garcia',
    domain: 'brine-thermodynamics',
    property: 'Brine Density',
    name: 'Garcia (2001) NaCl/CaCl\u2082 correlation',
    shortName: 'Garcia (2001) brine density',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Garcia, J.E.',
      year: 2001,
      title: 'Density of Aqueous Solutions of CO\u2082',
      journal: 'LBNL-49023, Lawrence Berkeley National Laboratory',
      note: 'Kell (1975) pure-water baseline; Bigg (1967) NaCl polynomial',
    },
    implementedIn: 'engine/classical/density.ts',
    exportedAs: 'brineDensityGarcia',
    knownLimitations: 'Polynomial fit valid 0\u2013200\u00b0C, 0\u201315 mol/kg NaCl; extrapolates outside this range.',
  },

  {
    id: 'brine-viscosity-constant',
    domain: 'brine-thermodynamics',
    property: 'Brine Viscosity',
    name: 'Vogel-Antoine temperature-dependent brine viscosity',
    shortName: 'Brine viscosity (Vogel-Antoine, T-dependent)',
    type: 'empirical',
    status: 'active',
    citation: {
      authors: 'Vogel, H. (1921); Antoine, C. (1888)',
      year: 1921,
      note: 'mu = 2.414e-5 * 10^(247.8 / (T_K - 140)), clamped to [1.5e-4, 1.5e-3] Pa\u00b7s. Captures supercritical-reservoir temperature range (30-200\u00b0C) without salinity or pressure correction.',
    },
    implementedIn: 'hooks/useSimulation.ts',
    knownLimitations: 'No salinity or pressure dependence. For high-salinity brines (>150 g/L TDS) or pressures >30 MPa, use Batzle & Wang (1992) or Phillips et al. (1981). Upgraded from hardcoded constant (6e-4 Pa\u00b7s) in July 2026.',
  },

  // ── Transport Properties ──────────────────────────────────────────────────

  {
    id: 'co2-solubility-duan-sun',
    domain: 'transport-properties',
    property: 'CO\u2082 Solubility (NaCl brine)',
    name: 'Duan & Sun (2003) Pitzer-type EOS',
    shortName: 'Duan-Sun (2003) solubility',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Duan, Z. & Sun, R.',
      year: 2003,
      title: 'An improved model calculating CO\u2082 solubility in pure water and aqueous NaCl solutions from 273 to 533 K and from 0 to 2000 bar',
      journal: 'Chemical Geology 193:257\u2013271',
      doi: '10.1016/S0009-2541(02)00263-2',
    },
    implementedIn: 'engine/classical/solubility.ts',
    exportedAs: 'co2SolubilityDuanSun',
    knownLimitations: '5-coefficient compact fit; \u00b15\u201310% vs full published EOS. For regulatory submissions use full Duan-Sun (2003) with all Pitzer terms.',
  },

  {
    id: 'co2-solubility-duan-2006',
    domain: 'transport-properties',
    property: 'CO\u2082 Solubility (Multi-Salt Brine)',
    name: 'Duan, Sun, Zhu & Chou (2006) multi-salt extension',
    shortName: 'Duan et al. (2006) multi-salt solubility',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Duan, Z., Sun, R., Zhu, C. & Chou, I.-M.',
      year: 2006,
      title: 'An improved model for the calculation of CO\u2082 solubility in aqueous solutions containing Na\u207a, K\u207a, Ca\u00b2\u207a, Mg\u00b2\u207a, Cl\u207b, and SO\u2084\u00b2\u207b',
      journal: 'Marine Chemistry 98(2\u20134):131\u2013139',
    },
    implementedIn: 'engine/classical/solubility.ts',
    exportedAs: 'calculateMultiSaltSolubility',
    knownLimitations: 'Ternary interaction (zeta) terms set to zero for screening accuracy; stored coefficients calibrated for MPa input.',
  },

  {
    id: 'co2-diffusion',
    domain: 'transport-properties',
    property: 'CO\u2082 Diffusion in Brine',
    name: 'Chapman-Enskog kinetic theory with tortuosity correction',
    shortName: 'Chapman-Enskog CO\u2082 diffusion',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Duan, Z. & Sun, R.',
      year: 2003,
      note: 'Base diffusivity ~2\u00d710\u207b\u2079 m\u00b2/s; tortuosity \u03c4=1.5 for sandstone. Chapman-Enskog T-scaling.',
    },
    implementedIn: 'engine/classical/diffusion.ts',
    exportedAs: 'co2DiffusionCoefficient',
    knownLimitations: 'Screening-level estimate; ignores salinity dependence on diffusivity.',
  },

  {
    id: 'ift-mars',
    domain: 'transport-properties',
    property: 'CO\u2082-Brine Interfacial Tension',
    name: 'MARS (Multivariate Adaptive Regression Splines) IFT model',
    shortName: 'MARS IFT (Olagunju et al., 2026)',
    type: 'ml',
    status: 'active',
    citation: {
      authors: 'Olagunju, D.T. et al.',
      year: 2026,
      title: 'MARS-based prediction of CO\u2082-brine interfacial tension across sub- and supercritical conditions',
      note: 'Olagunju et al. (2026). Trained on 3,265 experimental CO\u2082-brine IFT datapoints from 16 independent laboratories across 4 continents.',
    },
    implementedIn: 'engine/mars/evaluate.ts',
    exportedAs: 'evaluateMars',
    validatedAgainst: [
      { testFile: '__tests__/engine/mars/', expectedRange: 'External R\u00b2 = 0.945 (cross-laboratory holdout); RMSE < 2.1 mN/m' },
    ],
    knownLimitations: 'Two separate models: subcritical (16 terms, T<304.13 K) and supercritical (35 terms, T\u2265304.13 K). Applicability domain gated via conformal prediction intervals (80% PI). Scope: CO\u2082-brine IFT only; pure water and impure CO\u2082 streams not yet covered.',
  },

  // ── Relative Permeability ─────────────────────────────────────────────────

  {
    id: 'kr-van-genuchten-mualem',
    domain: 'relative-permeability',
    property: 'Relative Permeability (CO\u2082/brine)',
    name: 'van Genuchten (1980) + Mualem (1976) model with Krevor et al. (2012) parameters',
    shortName: 'van Genuchten\u2013Mualem kr',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'van Genuchten, M.Th.',
      year: 1980,
      title: 'A closed-form equation for predicting the hydraulic conductivity of unsaturated soils',
      journal: 'Soil Sci. Soc. Am. J. 44(5):892\u2013898',
      note: 'Mualem (1976) Water Resour. Res. 12(3):513\u2013522; lab parameters from Krevor et al. (2012) WRR 48:W02544',
    },
    implementedIn: 'engine/plume/relativePermeability.ts',
    exportedAs: 'krGasVG',
    knownLimitations: 'Berea/Fontainebleau sandstone parameters from Krevor et al. (2012); user-adjustable for other lithologies.',
  },

  {
    id: 'kr-brooks-corey',
    domain: 'relative-permeability',
    property: 'Relative Permeability (Brooks-Corey)',
    name: 'Brooks & Corey (1964) power-law kr model',
    shortName: 'Brooks-Corey (1964) kr',
    type: 'classical',
    status: 'alternative',
    alternativeTo: 'kr-van-genuchten-mualem',
    citation: {
      authors: 'Brooks, R.H. & Corey, A.T.',
      year: 1964,
      title: 'Hydraulic Properties of Porous Media',
      journal: 'USDA Hydrology Papers 3',
    },
    implementedIn: 'engine/plume/relativePermeability.ts',
    exportedAs: 'krGas',
    knownLimitations: 'Simpler power-law form; less accurate near residual saturations. Use van Genuchten-Mualem as primary for CO\u2082/brine systems.',
  },

  {
    id: 'kr-killough-land',
    domain: 'relative-permeability',
    property: 'kr Hysteresis (Imbibition)',
    name: 'Killough (1976) imbibition scanning + Land (1968) residual model',
    shortName: 'Killough\u2013Land hysteresis',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Land, C.S. & Killough, J.E.',
      year: 1976,
      title: 'Reservoir simulation with history-dependent saturation functions',
      journal: 'SPE J. 16(1):37\u201348 (Killough); Land (1968) Trans. AIME 243:149',
    },
    implementedIn: 'engine/plume/killoughHysteresis.ts',
    exportedAs: 'krGasHysteretic',
    knownLimitations: 'Land coefficient C=5.0 for intermediate sandstone; adjust via sgrMax parameter for other lithologies.',
  },

  // ── Capillary Pressure ────────────────────────────────────────────────────

  {
    id: 'capillary-pressure-brooks-corey',
    domain: 'capillary-pressure',
    property: 'Capillary Pressure',
    name: 'Brooks-Corey (1964) drainage / imbibition curves',
    shortName: 'Brooks-Corey (1964) Pc',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Brooks, R.H. & Corey, A.T.',
      year: 1964,
      title: 'Hydraulic Properties of Porous Media',
      journal: 'USDA Hydrology Papers 3',
    },
    implementedIn: 'engine/plume/capillaryPressure.ts',
    exportedAs: 'pcDrainage',
    knownLimitations: 'Pc capped at 10\u00d7Pe to avoid numerical blowup. Entry pressure Pe derived from MARS IFT output and caprock pore-throat radius.',
  },

  // ── Trapping Mechanisms ───────────────────────────────────────────────────

  {
    id: 'trapping-residual-land',
    domain: 'trapping-mechanisms',
    property: 'Residual CO\u2082 Trapping',
    name: 'Land (1968) residual saturation model',
    shortName: 'Land (1968) residual trapping',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Land, C.S.',
      year: 1968,
      title: 'Calculation of imbibition relative permeability for two- and three-phase flow from rock properties',
      journal: 'SPE J. 8(2):149\u2013156',
    },
    implementedIn: 'engine/plume/landTrapping.ts',
    exportedAs: 'computeResidualSaturation',
    knownLimitations: 'Land coefficient C=2.5 in classical module; C=5.0 in VE solver (sandstone default). Adjust for carbonate or tight reservoirs.',
  },

  {
    id: 'trapping-dissolution-riaz',
    domain: 'trapping-mechanisms',
    property: 'Dissolution / Solubility Trapping',
    name: 'Interfacial-area-limited mass transfer with Rayleigh convective onset (Riaz et al. 2006)',
    shortName: 'Dissolution trapping (Riaz et al. 2006)',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Riaz, A., Hesse, M., Tchelepi, H.A. & Orr, F.M.',
      year: 2006,
      title: 'Onset of convection in a gravitationally unstable, diffusive boundary layer in porous media',
      journal: 'J. Fluid Mech. 548:87\u2013111',
      note: 'Duan & Sun (2003) for equilibrium solubility; Ennis-King & Paterson (2005) for dissolution rate scaling',
    },
    implementedIn: 'engine/plume/dissolutionTrapping.ts',
    exportedAs: 'calculateDissolution',
    knownLimitations: 'Convective enhancement factor Ra/Ra_crit where Ra_crit=4\u03c0\u00b2; screening-level estimate only.',
  },

  {
    id: 'trapping-mineral-xu',
    domain: 'trapping-mechanisms',
    property: 'Mineral Trapping',
    name: 'Xu et al. (2004) geochemical kinetics',
    shortName: 'Xu et al. (2004) mineral trapping',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Xu, T., Apps, J.A. & Pruess, K.',
      year: 2004,
      title: 'Numerical simulation of CO\u2082 disposal by mineral trapping in deep aquifers',
      journal: 'Environ. Sci. Technol. 38(10):2790\u20132796',
    },
    implementedIn: 'engine/plume/mineralTrapping.ts',
    exportedAs: 'getMineralRate',
    knownLimitations: 'Active only after year 50 (geochemical equilibration period); T-factor Arrhenius correction relative to 60\u00b0C.',
  },

  {
    id: 'seal-capacity-laplace',
    domain: 'trapping-mechanisms',
    property: 'Caprock Seal Capacity',
    name: 'Laplace capillary entry pressure model (Schowalter 1979, Berg 1975)',
    shortName: 'Laplace seal capacity (Schowalter 1979)',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Schowalter, T.T.',
      year: 1979,
      title: 'Mechanics of secondary hydrocarbon migration and entrapment',
      journal: 'AAPG Bulletin 63(5):723\u2013760',
      note: 'Berg (1975) AAPG Bulletin 59(6):939\u2013956; Pe = 2\u03b3\u00b7cos\u03b8/r_throat',
    },
    implementedIn: 'engine/classical/caprockSealCapacity.ts',
    exportedAs: 'computeCaprockSealCapacity',
    knownLimitations: 'Uses MARS IFT output for \u03b3; pore-throat radius r is a user input or lithology default. Screening-level only.',
  },

  // ── Pressure Solver ───────────────────────────────────────────────────────

  {
    id: 'pressure-theis',
    domain: 'pressure-solver',
    property: 'Pressure (Single-Phase Transient)',
    name: 'Theis (1935) transient radial flow well function',
    shortName: 'Theis (1935) well function',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Theis, C.V.',
      year: 1935,
      title: 'The relation between the lowering of the piezometric surface and the rate and duration of discharge of a well using ground-water storage',
      journal: 'Trans. AGU 16(2):519\u2013524',
    },
    implementedIn: 'utils/computePressureField.ts',
    exportedAs: 'expIntegralE1',
    knownLimitations: 'Assumes infinite homogeneous aquifer, single fluid phase. Superseded by Nordbotten (2005) for two-phase CO\u2082 injection; retained for AoR baseline and single-phase validation.',
  },

  {
    id: 'pressure-nordbotten',
    domain: 'pressure-solver',
    property: 'Pressure (Two-Phase CO\u2082)',
    name: 'Nordbotten, Celia & Bachu (2005) two-phase composite radial flow',
    shortName: 'Nordbotten (2005) two-phase AoR',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Nordbotten, J.M., Celia, M.A. & Bachu, S.',
      year: 2005,
      title: 'Injection and Storage of CO\u2082 in Deep Saline Aquifers: Analytical Solution for CO\u2082 Plume Evolution During Injection',
      journal: 'Transp. Porous Media 58(3):339\u2013360',
    },
    implementedIn: 'utils/computePressureField.ts',
    exportedAs: 'computeAoRRadiusTwoPhase',
    validatedAgainst: [
      { testFile: '__tests__/hooks/sleipner_threeway.test.ts', expectedRange: 'BHP \u224810.4 MPa at k=2000 mD (open aquifer limit); FD solver matches for bounded domains' },
    ],
    knownLimitations: 'Analytical infinite-aquifer model. For bounded domains or k<100 mD, use the FD pressure solver for accurate BHP. Used for fast screening.',
  },

  {
    id: 'pressure-peaceman',
    domain: 'pressure-solver',
    property: 'Wellbore BHP Correction',
    name: 'Peaceman (1978) equivalent well-block radius',
    shortName: 'Peaceman (1978) well BHP',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Peaceman, D.W.',
      year: 1978,
      title: 'Interpretation of Well-Block Pressures in Numerical Reservoir Simulation',
      journal: 'SPE-6893-PA',
    },
    implementedIn: 'engine/ve/FDPressureSolver.ts',
    knownLimitations: 'r_eq = 0.1982\u00b7\u0394x for square cells; r_w = 0.1 m default wellbore radius.',
  },

  {
    id: 'pressure-fd-solver',
    domain: 'pressure-solver',
    property: 'Pressure Field (2D FD)',
    name: 'Implicit 5-point finite-difference backward-Euler with conjugate-gradient solver',
    shortName: 'Implicit FD pressure solver',
    type: 'numerical',
    status: 'active',
    citation: {
      authors: 'Internal CarbonLens',
      year: 2026,
      note: 'Matrix-free CG on 5-point SPD stencil; harmonic mean face transmissibilities; no-flow BCs. Replaces Nordbotten analytical for live 3D animation and bounded domains.',
    },
    implementedIn: 'engine/ve/FDPressureSolver.ts',
    exportedAs: 'solveFDPressure',
    validatedAgainst: [
      { testFile: '__tests__/engine/ve/sleipner_data_benchmark.test.ts', expectedRange: 'BHP \u224810.4\u201318 MPa at k=2000 mD (matches Nordbotten analytical for open aquifer; diverges correctly for bounded domain)' },
    ],
    knownLimitations: 'CG convergence in 60\u2013120 iterations for 60\u00d760 grid; condition number \u223cnx\u00b2. For very low permeability (<1 mD) may need preconditioning.',
  },

  {
    id: 'pressure-aor-chabora',
    domain: 'pressure-solver',
    property: 'Area of Review (AoR)',
    name: 'Chabora & Benson (2009) pressure-threshold AoR delineation',
    shortName: 'Chabora & Benson (2009) AoR',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Chabora, E. & Benson, S.M.',
      year: 2009,
      title: 'Brine displacement and leakage detection using pressure measurements in aquifer storage reservoirs',
      journal: 'GHGT-9 Energy Procedia 1(1)',
      note: 'EPA Class VI UIC Program Guidance, 40 CFR 146.84; threshold 6.9 kPa (1 psi)',
    },
    implementedIn: 'utils/computePressureField.ts',
    exportedAs: 'computeAoRRadius',
    knownLimitations: 'Bisection on Nordbotten (2005) composite \u0394P to find threshold contour radius. Single-phase fallback: Theis radial diffusion r\u2090\u1d3c\u1d3f = \u221a(4Kt/\u03c6\u03bcc_t).',
  },

  // ── Plume Migration ───────────────────────────────────────────────────────

  {
    id: 'plume-ve-solver',
    domain: 'plume-migration',
    property: 'CO\u2082 Plume Migration (VE)',
    name: 'Vertical Equilibrium 2D FD solver (Nordbotten & Celia 2006; Gasda et al. 2009; Hesse et al. 2008)',
    shortName: 'VE plume solver (Nordbotten & Celia 2006)',
    type: 'numerical',
    status: 'active',
    citation: {
      authors: 'Nordbotten, J.M. & Celia, M.A.',
      year: 2006,
      title: 'Similarity solutions for fluid injection into confined aquifers',
      journal: 'Water Resour. Res. 42:W01407',
      note: 'Gasda et al. (2009) Adv. Water Resour. 32:1322\u20131334; Hesse et al. (2008) J. Fluid Mech. 611:35\u201360',
    },
    implementedIn: 'engine/ve/VESolver.ts',
    exportedAs: 'VESolver',
    validatedAgainst: [
      { testFile: '__tests__/engine/ve/sleipner_data_benchmark.test.ts', expectedRange: 'Mass conservation 0.00%; plume radius \u00b115% vs Chadwick 2009 field data (seismic threshold)' },
      { testFile: '__tests__/hooks/sleipner_threeway.test.ts', expectedRange: 'CL-EOS: yr5 1.25 km\u00b2, yr10 3.25 km\u00b2 vs field 1.13, 3.80 km\u00b2 (\u00b115%)' },
    ],
    knownLimitations: 'Explicit forward-Euler upwind scheme; CFL-adaptive sub-stepping (~25 sub-steps/yr at 2000 mD). Numerical diffusion causes 4\u201337\u00d7 more cells vs MRST implicit at trace-CO\u2082 threshold; use \u03b7>5m threshold for field comparison.',
  },

  {
    id: 'plume-hesse-gravity-current',
    domain: 'plume-migration',
    property: 'Post-Injection Gravity Current',
    name: 'Hesse, Orr & Tchelepi (2008) self-similar gravity current',
    shortName: 'Hesse et al. (2008) post-injection',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Hesse, M.A., Orr, F.M. & Tchelepi, H.A.',
      year: 2008,
      title: 'Gravity currents with residual trapping',
      journal: 'J. Fluid Mech. 611:35\u201360',
      doi: '10.1017/S002211200800267X',
    },
    implementedIn: 'engine/plume/hessePostInjection.ts',
    exportedAs: 'computeHessePostInjection',
    knownLimitations: 'Buckley-Leverett fractional flow; two shocks (leading mobile, trailing residual). Assumes flat caprock; not valid for dipping or faulted structures.',
  },

  // ── Storage Screening ─────────────────────────────────────────────────────

  {
    id: 'storage-goodman-doe',
    domain: 'storage-screening',
    property: 'Storage Capacity',
    name: 'DOE/NETL Goodman et al. (2011) volumetric capacity methodology',
    shortName: 'DOE Goodman (2011) storage capacity',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Goodman, A. et al.',
      year: 2011,
      title: 'U.S. DOE methodology for the development of geologic storage potential for carbon dioxide at the national and regional scale',
      journal: 'Int. J. Greenhouse Gas Control 5(4):828\u2013833',
      note: 'Cc: P10=0.0051, P50=0.020, P90=0.055',
    },
    implementedIn: 'engine/classical/storageScreening.ts',
    exportedAs: 'assessStorageScreening',
    knownLimitations: 'Volumetric method gives P10\u2013P90 range; not a dynamic simulation. Cc coefficients are statistical averages across US saline aquifers.',
  },

  {
    id: 'storage-kopp-efficiency',
    domain: 'storage-screening',
    property: 'Storage Efficiency',
    name: 'Kopp, Class & Helmig (2010) trapping efficiency decomposition',
    shortName: 'Kopp et al. (2010) storage efficiency',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Kopp, A., Class, H. & Helmig, R.',
      year: 2010,
      title: 'Investigations on CO\u2082 storage capacity in saline aquifers',
      journal: 'Int. J. Greenhouse Gas Control 4(4):727\u2013740',
    },
    implementedIn: 'engine/classical/storageScreening.ts',
    knownLimitations: 'E_geo, E_sweep, E_disp decomposition; sweep efficiency uses Buckley-Leverett end-point mobility ratio.',
  },

  {
    id: 'storage-shook-sweep',
    domain: 'storage-screening',
    property: 'Sweep Efficiency',
    name: 'Shook & Mitchell (2009) flow-quality index sweep efficiency',
    shortName: 'Shook & Mitchell (2009) sweep efficiency',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Shook, G.M. & Mitchell, K.M.',
      year: 2009,
      title: 'A Robust Measure of Heterogeneity for Ranking Earth Models',
      journal: 'SPE-124625-MS, SPE ATCE 2009',
    },
    implementedIn: 'engine/classical/storageScreening.ts',
    knownLimitations: 'Derived from tracer-based heterogeneity index (FQI). Dykstra-Parsons V_DP used as proxy for FQI; validated against layered aquifer studies.',
  },

  {
    id: 'storage-heterogeneity-dykstra',
    domain: 'storage-screening',
    property: 'Heterogeneity Correction',
    name: 'Dykstra-Parsons log-normal permeability distribution with AoR heterogeneity scaling',
    shortName: 'Dykstra-Parsons heterogeneity correction',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Dykstra, H. & Parsons, R.L.',
      year: 1950,
      title: 'The prediction of oil recovery by water flood',
      journal: 'Secondary Recovery of Oil in the United States, API, p. 160\u2013174',
      note: 'AoR scaling: r_AoR_corr = r_AoR \u00d7 exp(\u03c3\u00b2/4), \u03c3 = \u2212ln(1\u2212V_DP)',
    },
    implementedIn: 'engine/classical/heterogeneityCorrection.ts',
    exportedAs: 'computeHeterogeneityCorrections',
    knownLimitations: 'Log-normal permeability distribution assumed. V_DP from user input or lithology default.',
  },

  // ── Geomechanics ──────────────────────────────────────────────────────────

  {
    id: 'geomech-hubbert-willis',
    domain: 'geomechanics',
    property: 'Fracture Pressure / MAIP',
    name: 'Hubbert & Willis (1957) minimum horizontal stress fracture pressure',
    shortName: 'Hubbert & Willis (1957) fracture pressure',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Hubbert, M.K. & Willis, D.G.',
      year: 1957,
      title: 'Mechanics of hydraulic fracturing',
      journal: 'Trans. AIME 210:153\u2013166',
    },
    implementedIn: 'engine/plume/faultReactivation.ts',
    knownLimitations: 'Poisson ratio \u03bd=0.30 default; user-adjustable. MAIP = 0.9 \u00d7 Pf per Bachu et al. (2007).',
  },

  {
    id: 'geomech-mohr-coulomb',
    domain: 'geomechanics',
    property: 'Shear Failure / Fault Reactivation',
    name: 'Mohr-Coulomb shear failure + Biot (1941) poroelastic coupling',
    shortName: 'Mohr-Coulomb geomechanics',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Jaeger, J.C., Cook, N.G.W. & Zimmerman, R.W.',
      year: 2007,
      title: 'Fundamentals of Rock Mechanics, 4th ed.',
      journal: 'Blackwell Publishing',
      note: 'Streit & Hillis (2004) Energy 29(9\u201310):1445\u20131456; Byerlee (1978) friction law',
    },
    implementedIn: 'engine/plume/faultReactivation.ts',
    exportedAs: 'assessFaultReactivation',
    knownLimitations: 'Slip tendency Ts = \u03c4/\u03c3_eff_n; 2D plane-stress; fault orientation from user input. Byerlee friction: \u03bc=0.85 (\u03c3_eff<200 MPa), \u03bc=0.6 (>200 MPa).',
  },

  {
    id: 'geomech-surface-heave',
    domain: 'geomechanics',
    property: 'Surface Heave',
    name: 'Teatini et al. (2011) nucleus-of-strain elastic approximation',
    shortName: 'Teatini et al. (2011) surface heave',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Teatini, P. et al.',
      year: 2011,
      title: 'Resolving pumping-induced land subsidence and groundwater flow in a multiaquifer system',
      journal: 'J. Geophys. Res. 116:B08204',
    },
    implementedIn: 'engine/plume/faultReactivation.ts',
    knownLimitations: 'Elastic approximation: \u03b4 \u2248 (\u0394P\u00b7h/E)\u00b7(1\u2212\u03bd\u00b2)\u00b7a; valid for flat surface, isotropic elastic halfspace.',
  },

  // ── Thermal ───────────────────────────────────────────────────────────────

  {
    id: 'thermal-geothermal',
    domain: 'thermal',
    property: 'Reservoir Temperature Profile',
    name: 'Linear geothermal gradient',
    shortName: 'Linear geothermal gradient (30\u00b0C/km)',
    type: 'empirical',
    status: 'active',
    citation: {
      authors: 'N/A',
      year: 2026,
      note: 'T(z) = T_surface + gradient\u00b7z; default 30\u00b0C/km (typical sedimentary basin). User-adjustable in FormationInputs.',
    },
    implementedIn: 'engine/plume/thermalEffects.ts',
    exportedAs: 'reservoirTemperature',
    knownLimitations: 'Depth-averaged T used for VE property field; cell-by-cell depth correction requires topDepthField from structural module.',
  },

  {
    id: 'thermal-jt-cooling',
    domain: 'thermal',
    property: 'Joule-Thomson Near-Wellbore Cooling',
    name: 'Ziabakhsh-Ganji & Kooi (2012) Joule-Thomson coefficient for CO\u2082-brine',
    shortName: 'Ziabakhsh-Ganji & Kooi (2012) JT cooling',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Ziabakhsh-Ganji, Z. & Kooi, H.',
      year: 2012,
      title: 'An equation of state for thermodynamic equilibrium of gas mixtures and brines to allow simulation of the effects of impurities in subsurface CO\u2082 storage',
      journal: 'Int. J. Greenhouse Gas Control 11S:S21\u2013S34',
      doi: '10.1016/j.ijggc.2012.07.025',
      note: 'JT coefficient: \u03bc_JT \u2248 0.50\u20130.70 K/MPa at supercritical conditions (T > 31\u00b0C, P > 7.38 MPa)',
    },
    implementedIn: 'engine/plume/thermalEffects.ts',
    exportedAs: 'jouleThomsonCooling',
    knownLimitations: 'Piecewise-linear approximation of \u03bc_JT vs T; rigorous values require NIST REFPROP. Valid for screening-grade JT estimate (\u00b115%).',
    changelog: [
      { date: '2026-07-24', description: 'Coupled into VE solver via thermalPropertyField.ts per-cell T evaluation.' },
    ],
  },

  {
    id: 'thermal-radial-diffusion',
    domain: 'thermal',
    property: 'Near-Wellbore Thermal Recovery',
    name: 'Line-source heat conduction erfc solution (Benson & Cole 2008; Mathias, Hardisty, Trudell & Zimmerman 2009)',
    shortName: 'Radial heat diffusion erfc (Mathias et al. 2009)',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Mathias, S.A., Hardisty, P.E., Trudell, M.R. & Zimmerman, R.W.',
      year: 2009,
      title: 'Approximate solutions for pressure buildup during CO\u2082 injection in brine aquifers',
      journal: 'Transport in Porous Media 79(2):265\u2013284',
      doi: '10.1007/s11242-008-9316-7',
      note: 'Benson & Cole (2008) Elements 4(5):325\u2013331 DOI:10.2113/gselements.4.5.325; analytical thermal recovery model',
    },
    implementedIn: 'engine/plume/thermalEffects.ts',
    exportedAs: 'radialTemperatureProfile',
    knownLimitations: 'Semi-infinite line-source assumption; valid for r >> wellbore radius. Thermal anisotropy and bedding-parallel conductivity not included.',
    changelog: [
      { date: '2026-07-24', description: 'Coupled into VE solver via thermalPropertyField.ts; erfc solution provides T(r,t) field for Span-Wagner + Fenghour property evaluation.' },
    ],
  },

  {
    id: 'plume-structural-dip',
    domain: 'plume-migration',
    property: 'Structural Dip CO\u2082 Migration',
    name: 'VE top-surface topography with structural gradient correction (Nilsen et al. 2012)',
    shortName: 'Nilsen et al. (2012) VE structural dip',
    type: 'numerical',
    status: 'active',
    citation: {
      authors: 'Nilsen, H.M., Nordbotten, J.M. & Raynaud, X.',
      year: 2012,
      title: 'Characterization of the CO\u2082 storage capacity based on a top-surface grid',
      journal: 'Computational Geosciences 16(2):399\u2013416',
      doi: '10.1007/s10596-011-9257-z',
      note: 'Driving force: \u2207(\u03b7 \u2212 2D) where D = caprock top depth (m TVD); CO\u2082 migrates up-dip toward smaller D.',
    },
    implementedIn: 'engine/ve/VESolver.ts',
    exportedAs: 'VESolver',
    validatedAgainst: [
      { testFile: '__tests__/engine/ve/structuralDipVE.test.ts', expectedRange: 'Up-dip migration for 3\u00b0 dip; dome pooling at apex; flat baseline within 5% mass balance tolerance.' },
    ],
    knownLimitations: 'Cartesian grid with depth correction; cannot represent overhanging geometries, salt diapirs, or reverse-fault cross-connections. Screening-grade structural trapping only.',
    changelog: [
      { date: '2026-07-24', description: 'Added topDepthField to VEGrid; VESolver.step() applies \u2207(\u03b7\u22122D) structural gravity correction. Depth map built from HorizonShapeParams via buildTopDepthField().' },
    ],
  },

  {
    id: 'plume-fault-transmissibility',
    domain: 'plume-migration',
    property: 'Fault Transmissibility',
    name: 'Manzocchi et al. (1999) fault transmissibility multiplier',
    shortName: 'Manzocchi et al. (1999) fault mult.',
    type: 'empirical',
    status: 'active',
    citation: {
      authors: 'Manzocchi, T. et al.',
      year: 1999,
      title: 'Fault transmissibility multipliers for flow simulation models',
      journal: 'Petroleum Geoscience 5(1):53\u201363',
      doi: '10.1144/petgeo.5.1.53',
      note: 'sealingFactor \u2208 [0,1] (0=sealing, 1=open) from FaultDefinition maps to face transmissibility multiplier T_face = T_open \u00d7 sealingFactor.',
    },
    implementedIn: 'engine/classical/faultTransmissibility.ts',
    exportedAs: 'buildFaultMultField',
    validatedAgainst: [
      { testFile: '__tests__/engine/classical/faultTransmissibility.test.ts', expectedRange: 'Fully sealing fault sets face mult = 0; fully open fault leaves all mults = 1; partial sealing \u2208 [0,1].' },
      { testFile: '__tests__/engine/ve/structuralDipVE.test.ts', expectedRange: 'Sealing fault reduces cross-fault plume area vs unfaulted baseline.' },
    ],
    knownLimitations: 'Fault trace rasterised at sub-cell resolution; fault dip and throw do not alter grid geometry (no 3D fault displacement). Transmissivity multiplier is the only fault representation; no across-fault juxtaposition analysis.',
    changelog: [
      { date: '2026-07-24', description: 'Rasterises FaultDefinition traces onto VE grid faces. Multiple overlapping faults use minimum (most sealing) multiplier.' },
    ],
  },

  // ── Benchmark Validation ──────────────────────────────────────────────────

  {
    id: 'validation-sleipner',
    domain: 'benchmark-validation',
    property: 'Sleipner Utsira CO\u2082 Injection Benchmark',
    name: 'Sleipner 4D seismic and gravimetric monitoring benchmark',
    shortName: 'Sleipner benchmark (Furre 2017)',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Furre, A.-K. et al.',
      year: 2017,
      title: '20 Years of Monitoring CO\u2082-injection at Sleipner',
      journal: 'Energy Procedia 114:3916\u20133926',
      note: 'Chadwick et al. (2004) Energy 29(9\u201310); Boait et al. (2012) JGR 117:B03309',
    },
    implementedIn: 'data/sleipnerBenchmark.ts',
    validatedAgainst: [
      { testFile: '__tests__/engine/ve/sleipner_data_benchmark.test.ts', expectedRange: 'Plume radius \u00b115%; dissolution rate \u22642.7%/yr (Furre 2017 gravimetry)' },
      { testFile: '__tests__/hooks/sleipner_threeway.test.ts', expectedRange: 'CL-EOS \u00b115% vs 4D seismic field area (Chadwick 2009)' },
    ],
    knownLimitations: 'Model excludes 9 intra-formational shale baffles; uses bulk homogeneous Utsira parameters. BHP not comparable (shale baffles increase real injection pressure to ~33 MPa).',
  },

  {
    id: 'validation-spe11a',
    domain: 'benchmark-validation',
    property: 'SPE11A CO\u2082 Storage Benchmark',
    name: 'SPE Comparative Solution Project Case 11A',
    shortName: 'SPE11A benchmark (Nordbotten 2024)',
    type: 'classical',
    status: 'active',
    citation: {
      authors: 'Nordbotten, J.M. et al.',
      year: 2024,
      title: 'The 11th Society of Petroleum Engineers Comparative Solution Project: problem definition',
      note: 'Flemisch et al. (2024) benchmark comparison results',
    },
    implementedIn: '__tests__/audit/',
    validatedAgainst: [
      { testFile: '__tests__/audit/', expectedRange: 'Immiscible fraction 0.15\u20130.22; storage efficiency Cc \u2208 [0.004, 0.06]' },
    ],
    knownLimitations: 'Semi-analytical pressure and saturation; agrees within P10\u2013P90 benchmark envelope.',
  },
]

// ---------------------------------------------------------------------------
// Render helpers — use these in report generators and UI panels
// ---------------------------------------------------------------------------

/**
 * Format a citation into a human-readable string.
 *
 * Styles:
 *   'short'  "Span & Wagner (1996)"
 *   'full'   "Span & Wagner (1996) J. Phys. Chem. Ref. Data 25(6):1509-1596"
 *   'inline' "Span-Wagner (1996) CO₂ EOS"  (uses shortName from entry, for Simulation Engine string)
 */
export function renderCitation(citation: Citation, style: 'short' | 'full' = 'full'): string {
  const authorYear = `${citation.authors} (${citation.year})`
  if (style === 'short') return authorYear
  const parts = [authorYear]
  if (citation.journal) parts.push(citation.journal)
  if (citation.doi) parts.push(`DOI: ${citation.doi}`)
  if (citation.note) parts.push(citation.note)
  return parts.join('. ')
}

/**
 * Returns the "Simulation Engine" attribution string used in report covers.
 * Includes all active non-benchmark models, ordered by domain.
 * Example: "Span-Wagner (1996) CO₂ EOS · Garcia (2001) brine density · ..."
 */
export function renderSimEngineAttribution(): string {
  const DOMAIN_ORDER: ModelDomain[] = [
    'co2-thermodynamics',
    'brine-thermodynamics',
    'transport-properties',
    'relative-permeability',
    'capillary-pressure',
    'trapping-mechanisms',
    'pressure-solver',
    'plume-migration',
    'storage-screening',
    'geomechanics',
    'thermal',
  ]
  const active = MODEL_REGISTRY.filter(m =>
    m.status === 'active' &&
    m.domain !== 'benchmark-validation',
  )
  const ordered: ModelEntry[] = []
  for (const domain of DOMAIN_ORDER) {
    ordered.push(...active.filter(m => m.domain === domain))
  }
  return ordered.map(m => m.shortName).join(' \u00b7 ')
}

/**
 * Returns HTML <tr> rows for the "Data Provenance" table in the pre-screening report.
 * Each row has: component name | model description | full citation.
 * Excludes benchmark-validation entries, stubs, and hardcoded constants (shown separately).
 */
export function renderProvenanceTableRows(): string {
  const included = MODEL_REGISTRY.filter(m =>
    m.domain !== 'benchmark-validation' &&
    m.status !== 'stub' &&
    m.status !== 'deprecated',
  )
  const rowBg = (i: number) => i % 2 === 1 ? ' style="background:#f8fafc;"' : ''
  return included.map((m, i) => {
    const limitNote = m.status === 'hardcoded-constant'
      ? ` <em style="color:#b45309;">[no correlation: ${m.knownLimitations ?? 'constant value'}]</em>`
      : m.knownLimitations
        ? ` <em style="color:#64748b;">${m.knownLimitations}</em>`
        : ''
    const citFull = renderCitation(m.citation, 'full')
    const doi = m.citation.doi
      ? ` <a href="https://doi.org/${m.citation.doi}" style="color:#00c4a0;">DOI</a>`
      : ''
    return `<tr${rowBg(i)}><td style="padding:5px 10px;color:#0d1f3c;font-weight:600;">${m.property}</td><td style="padding:5px 10px;">${m.name}${limitNote}</td><td style="padding:5px 10px;font-size:7.5pt;">${citFull}${doi}</td></tr>`
  }).join('\n')
}

/**
 * Returns a compact plain-text attribution paragraph for footers and footnotes.
 * Lists all active models grouped by domain, separated by semicolons.
 */
export function renderPhysicsFootnote(): string {
  const domains: ModelDomain[] = [
    'co2-thermodynamics', 'brine-thermodynamics', 'transport-properties',
    'relative-permeability', 'trapping-mechanisms', 'pressure-solver', 'plume-migration',
    'storage-screening', 'geomechanics', 'thermal',
  ]
  const lines: string[] = []
  for (const domain of domains) {
    const models = MODEL_REGISTRY.filter(m => m.domain === domain && m.status === 'active')
    if (models.length === 0) continue
    const label = domain.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    lines.push(`${label}: ${models.map(m => m.shortName).join(', ')}`)
  }
  return lines.join('; ')
}

/**
 * Returns the structured list of active classical components for use in
 * UI panels (replaces the hardcoded classicalComponents array in methodology.ts).
 */
export function getClassicalComponents(): Array<{ property: string; model: string; phd: boolean }> {
  return MODEL_REGISTRY
    .filter(m => m.type === 'classical' && m.status === 'active' && m.domain !== 'benchmark-validation')
    .map(m => ({
      property: m.property,
      model: m.name,
      phd: false,  // PhD-era upgrade marker is set manually on specific entries below
    }))
}

/**
 * Returns all entries with a pending PhD-era upgrade (solubility in divalent
 * brines, CO2 viscosity at high P/T, etc.).
 */
export const PHD_UPGRADE_IDS: string[] = [
  'co2-viscosity-laesecke',
  'co2-solubility-duan-sun',
  'co2-solubility-duan-2006',
  'brine-density-garcia',
]
