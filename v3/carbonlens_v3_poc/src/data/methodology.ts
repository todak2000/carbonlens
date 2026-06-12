export interface Equation {
  name: string
  formula: string
  params: string
  reference: string
  notes?: string
}

export interface MethodologySection {
  domain: string
  equations: Equation[]
}

export const METHODOLOGY: MethodologySection[] = [
  {
    domain: 'CO\u2082 Density',
    equations: [{
      name: 'Span-Wagner (1996) Helmholtz EOS',
      formula: 'P = \u03c1\u00b7R_spec\u00b7T\u00b7(1 + \u03b4\u00b7\u2202\u03b1r/\u2202\u03b4); \u03b4 = \u03c1/\u03c1c; \u03c4 = Tc/T; \u03b1r = \u03a3 n_i\u00b7\u03b4^d_i\u00b7\u03c4^t_i\u00b7[polynomial + exp + Gaussian + nonanalytic]',
      params: 'Tc = 304.1282 K; \u03c1c = 467.6 kg/m\u00b3; R_spec = 188.9241 J/(kg\u00b7K); 42-term residual Helmholtz free energy (7 polynomial + 27 exponential + 5 Gaussian + 3 nonanalytic)',
      reference: 'Span & Wagner (1996) J. Phys. Chem. Ref. Data 25(6), 1509\u20131596',
      notes: 'Accuracy \u00b10.03\u20130.05% vs NIST REFPROP at CCS reservoir conditions (T=280\u2013500 K, P=0.1\u2013100 MPa). Industry standard for CO\u2082 PVT computation. Near-critical region (|T\u2212Tc| < 10 K) handled by Gaussian and nonanalytic terms.',
    }],
  },
  {
    domain: 'Brine Density',
    equations: [{
      name: 'Garcia (2001) NaCl/CaCl\u2082 correlation',
      formula: '\u03c1_brine = \u03c1_w + A\u00b7S + B\u00b7S\u00b2 + C\u00b7S\u00b3',
      params: 'S: effective salinity (g/L), \u03c1_w: pure water density (kg/m\u00b3)',
      reference: 'Garcia (2001) LBNL-49023; extended for CaCl\u2082 (MW = 110.98 g/mol)',
      notes: 'Separate molecular weight used for NaCl (58.44) and CaCl\u2082 (110.98) in mol/kg to g/L conversion.',
    }],
  },
  {
    domain: 'CO\u2082 Viscosity',
    equations: [{
      name: 'NIST-calibrated two-part correlation',
      formula: '\u03b7 = (\u03b7\u2080(T) + \u0394\u03b7(\u03c1)) \u00d7 10\u207b\u2076 Pa\u00b7s',
      params: '\u03b7\u2080: zero-density limit (quadratic in T); \u0394\u03b7: excess density term (cubic in \u03c1\u1d63 = \u03c1/467.6)',
      reference: 'Calibrated to NIST REFPROP; inspired by Fenghour et al. (1998) J. Phys. Chem. Ref. Data 27(1), 31-44',
      notes: '\u00b110-15% over 300-400 K, 0-100 MPa reservoir range.',
    }],
  },
  {
    domain: 'CO\u2082 Solubility',
    equations: [{
      name: 'Duan-Sun (2003) EOS',
      formula: 'ln(y_CO\u2082 \u00b7 P) = \u03bc\u00b0(T,P)/RT + 2\u03bb\u00b7m_Na + \u03be\u00b7m_Na\u00b7m_Cl',
      params: 'y_CO\u2082: CO\u2082 mole fraction; m: molality; \u03bb, \u03be: interaction parameters',
      reference: 'Duan & Sun (2003) Chem. Geol. 193, 257-271',
      notes: 'Pitzer-type ionic strength approximation for CaCl\u2082 (BCM). Accurate to \u00b13% for NaCl brines.',
    }],
  },
  {
    domain: 'Interfacial Tension',
    equations: [{
      name: 'MARS (Multivariate Adaptive Regression Splines)',
      formula: 'IFT = f(Pr, Tr, MCM, BCM, x_CH\u2084, x_N\u2082, \u0394\u03c1\u00b2, BCM_bin, CH\u2084_bin, N\u2082_bin)',
      params: 'Pr: reduced pressure; Tr: reduced temperature; MCM/BCM: mono/bivalent salinity (mol/kg)',
      reference: 'Olagunju et al. (in prep) \u2014 MSc research, UTP Malaysia; trained on 847 data points',
      notes: 'Subcritical and supercritical regimes use separate models. Applicability domain assessed via conformal prediction intervals.',
    }],
  },
  {
    domain: 'Pressure Response',
    equations: [
      {
        name: 'Theis (1935) transient radial flow',
        formula: '\u0394P(r,t) = Q\u03bc/(4\u03c0kh) \u00b7 W(u); u = r\u00b2\u03c6\u03bcc_t/(4kt); W(u) = -Ei(-u) = \u222b_u^\u221e e^{-s}/s ds',
        params: 'Q: injection rate (m\u00b3/s); k: permeability (m\u00b2); h: thickness (m); \u03c6: porosity; c_t: total compressibility (Pa\u207b\u00b9); W(u): Theis well function (exponential integral)',
        reference: 'Theis, C.V. (1935) Trans. AGU 16(2), 519\u2013524',
        notes: 'Single-phase transient radial flow baseline. Used for injection-well Peaceman pressure and multi-well superposition. Superseded by Nordbotten (2005) for two-phase CO\u2082 plume pressure in the far field.',
      },
      {
        name: 'Nordbotten (2005) two-phase composite radial flow',
        formula: '\u0394P(r,t) = Q/(4\u03c0kh) \u00b7 [\u03bc_b\u00b7E\u2081(r\u00b2/4\u03b1_b\u00b7t) + (\u03bc_eff\u2212\u03bc_b)\u00b7E\u2081(R_p\u00b2/4\u03b1_b\u00b7t)]',
        params: '\u03bc_b: brine viscosity (Pa\u00b7s); \u03bc_eff: CO\u2082-zone effective viscosity (\u03bc_CO\u2082/k_r,CO\u2082); R_p: plume radius; \u03b1_b = k/(\u03c6\u03bc_b c_t): brine hydraulic diffusivity',
        reference: 'Nordbotten, Celia & Bachu (2005) Transp. Porous Media 58(3):339\u2013360',
        notes: 'Outer zone governed by brine mobility (far-field pressure); inner CO\u2082 zone adds mobility-ratio correction. Multi-well superposition applied. Capped at 25 MPa overpressure.',
      },
    ],
  },
  {
    domain: 'Trapping Mechanisms',
    equations: [
      {
        name: 'Land (1968) residual trapping',
        formula: 'Sgr = Sg_max / (1 + C\u00b7Sg_max), C = 2.5',
        params: 'Sgr: residual CO\u2082 saturation; Sg_max: maximum drainage saturation; C: Land coefficient',
        reference: 'Land (1968) SPE J. 8(2), 149-156',
      },
      {
        name: 'Killough (1976) imbibition kr hysteresis',
        formula: 'kr_imb(Sg) = kr_drain(Sg_max) \u00d7 (Se_imb/Se_max)^n_gas',
        params: 'Se: effective saturation; Sgr_eff: Land-model effective residual saturation',
        reference: 'Killough (1976) SPE J. 16(1), 37-48',
      },
      {
        name: 'Dissolution trapping (interfacial-area limited)',
        formula: 'dC/dt = k_La \u00b7 a_s \u00b7 (C_sat - C_bulk) \u00b7 E_conv',
        params: 'k_La: mass transfer coeff (1e-8 m/s); a_s: specific interfacial area; E_conv: convective enhancement factor',
        reference: 'Riaz et al. (2006) J. Fluid Mech. 548, 87-111 (convective onset criterion)',
        notes: 'Convective enhancement: Ra/Ra_crit where Ra = \u0394\u03c1\u00b7k\u00b7g\u00b7H/(\u03c6\u00b7D\u00b7\u03bc), Ra_crit = 4\u03c0\u00b2.',
      },
      {
        name: 'Mineral trapping (Xu et al. kinetics)',
        formula: 'dS_min/dt = R_kin \u00b7 Sg_diss \u00b7 T_factor, T_factor = exp(0.035\u00b7max(0,T\u221260))',
        params: 'R_kin: lithology-specific rate (sandstone 0.0008, shale 0.0001, anhydrite 0.0 /yr)',
        reference: 'Xu et al. (2004) Environ. Sci. Technol. 38(10), 2790-2796',
        notes: 'Active only after year 50 (geochemical equilibration period).',
      },
    ],
  },
  {
    domain: 'Relative Permeability',
    equations: [
      {
        name: 'van Genuchten\u2013Mualem (1980/1976)',
        formula: 'k_rg = k_rg_max\u00b7(1\u2212S_e)^0.5\u00b7(1\u2212S_e^(1/m))^(2m);  k_rw = k_rw_max\u00b7S_e^0.5\u00b7(1\u2212(1\u2212S_e^(1/m))^m)\u00b2',
        params: 'S_e = (S_g\u2212S_gr)/(1\u2212S_wc\u2212S_gr); m = 1\u22121/n (pore-size distribution); n = 1.5\u20132.0 (sandstone)',
        reference: 'van Genuchten (1980) Soil Sci. Soc. Am. J. 44(5):892\u2013898; Mualem (1976) Water Resour. Res. 12(3):513\u2013522; Krevor et al. (2012) Water Resour. Res. 48:W02544',
        notes: 'Laboratory Berea/Fontainebleau parameters from Krevor et al. (2012). Supersedes Brooks-Corey for two-phase CO\u2082/brine systems with smoother saturation transition.',
      },
      {
        name: 'Killough\u2013Land hysteresis (1968/1976)',
        formula: 'S_gr_eff = S_gr_max\u00b7S_g_max/(1 + C\u00b7S_g_max);  S_mobile = max(0, S_g \u2212 S_gr_eff) during imbibition',
        params: 'C = 5.0 (Land coefficient); S_gr_max = 0.30; S_g_max: historical maximum CO\u2082 saturation at each grid cell',
        reference: 'Land (1968) SPE-1965-PA; Killough (1976) SPE-5765-PA',
        notes: 'Wired into VE solver: during imbibition phase, only mobile CO\u2082 (above effective residual) contributes to buoyancy flux. Trapped mass tracked as separate output field (trappedMass_Mt).',
      },
    ],
  },
  {
    domain: 'Capillary Pressure',
    equations: [{
      name: 'Brooks-Corey drainage curve',
      formula: 'Pc = Pe \u00b7 (Sw_e)^(-1/\u03bb)',
      params: 'Pe: entry pressure (MPa); \u03bb: pore-size index (sandstone 2.5, shale 3.0, anhydrite 4.0); Sw_e: effective water saturation',
      reference: 'Brooks & Corey (1964) USDA Hydrology Papers 3',
      notes: 'Pc capped at 10\u00d7Pe. Imbibition curve uses Sw_eff = min(1, Sw + 0.15\u00b7Sg_max).',
    }],
  },
  {
    domain: 'Geomechanics',
    equations: [
      {
        name: 'Fracture pressure (Hubbert-Willis)',
        formula: 'Pf = ((\u03c3v\u2212Pp)\u00b7\u03bd/(1\u2212\u03bd) + Pp) \u00d7 (1 + tan(\u03c6)\u00b70.15)',
        params: '\u03c3v: overburden stress (MPa); Pp: pore pressure; \u03bd: Poisson ratio (0.30); \u03c6: friction angle',
        reference: 'Hubbert & Willis (1957) Trans. AIME 210, 153-163',
      },
      {
        name: 'Mohr-Coulomb shear failure',
        formula: 'Margin = C + \u03c3_mean\u00b7tan(\u03c6) \u2212 (\u03c3v\u2212\u03c3h)/2 > 0 for stability',
        params: 'C: cohesion (MPa); \u03c3_mean: effective mean stress including Biot poroelastic correction',
        reference: 'Jaeger & Cook (1979) Fundamentals of Rock Mechanics, 3rd ed.',
      },
      {
        name: 'Stress-dependent permeability',
        formula: 'k = k\u2080\u00b7exp(c_k\u00b7\u03b1\u00b7\u0394P), \u03c6 = \u03c6\u2080\u00b7(k/k\u2080)^(1/3)',
        params: 'c_k = 0.03 MPa\u207b\u00b9 (stress sensitivity); \u03b1 = 0.70 (Biot coefficient); \u0394P: injection overpressure',
        reference: 'Rutqvist & Tsang (2002) Int. J. Rock Mech. 39(4), 429-442; Kozeny-Carman porosity scaling',
      },
    ],
  },
  {
    domain: 'Storage Capacity',
    equations: [{
      name: 'DOE storage efficiency framework',
      formula: 'M_CO\u2082 = \u03c1_CO\u2082 \u00b7 A \u00b7 h \u00b7 \u03c6 \u00b7 NTG \u00b7 Cc',
      params: 'Cc: storage efficiency (P10=0.0051, P50=0.020, P90=0.055); A: area (m\u00b2); h: thickness (m)',
      reference: 'Goodman et al. (2011) Int. J. Greenhouse Gas Control 5(4), 828-833',
      notes: 'Cc coefficients from DOE National Carbon Sequestration Database.',
    }],
  },
  {
    domain: 'Benchmark Validation',
    equations: [
      {
        name: 'Sleipner CO\u2082 injection — plume match',
        formula: 'r_plume(\u03c4) \u2248 r_observed \u00b1 8%;  diss. rate \u2264 2.7%/yr (Furre 2017 gravimetry constraint)',
        params: '\u03c4: simulation year; r_plume: gravity-current plume radius (m)',
        reference: 'Furre et al. (2017) Energy Procedia 114, 3916-3926; Chadwick et al. (2004) Energy 29(9-10)',
        notes: 'Dissolution trapping rate calibrated to Sleipner gravimetric upper bound of 2.7%/yr CO\u2082 loss from free plume.',
      },
      {
        name: 'SPE11A benchmark comparison',
        formula: 'Storage efficiency Cc within [0.004, 0.06] range; immiscible fraction matches reported 0.15\u20130.22',
        params: 'Cc: storage coefficient; immiscible fraction: mobile plume / total injected',
        reference: 'Nordbotten et al. (2024) SPE11A benchmark specification; Flemisch et al. (2024)',
        notes: 'Semi-analytical pressure and saturation results agree within benchmark envelope on the P10\u2013P90 capacity range.',
      },
    ],
  },
]

// ── ML model attribution record — rendered separately from equations ────────────
export const MARS_ATTRIBUTION = {
  title: 'MARS Interfacial Tension Model',
  subtitle: 'Machine learning contribution — MSc research, Universiti Teknologi PETRONAS, Malaysia',
  author: 'Daniel T. Olagunju',
  institution: 'Universiti Teknologi PETRONAS (UTP), Malaysia',
  status: 'MSc research (in preparation for submission)',
  dataset: '3,265 experimental CO\u2082-brine IFT datapoints · 16 independent laboratories · 4 continents',
  framework: 'Cross-Laboratory External Validation (CLEV) — SHA-256-locked holdout of entire laboratories before training',
  finding: 'ANN: test R\u00b2 = 0.964 \u2192 external R\u00b2 = \u22120.48 (catastrophic failure)\nMARS: test R\u00b2 = 0.939 \u2192 external R\u00b2 = 0.945 (reliable generalisation)',
  models: [
    { regime: 'Subcritical (T < 304.13 K)', terms: 16, intercept: 23.14 },
    { regime: 'Supercritical (T \u2265 304.13 K)', terms: 35, intercept: 17.82 },
  ],
  uncertainty: 'Conformal prediction intervals (80% PI) · Uncertainty Inflation Factor for apparatus-offset diagnosis',
  scopeNote: 'This model covers CO\u2082-brine IFT only. Contact angle, CO\u2082 solubility in divalent brines, multi-component brine density, and impure CO\u2082 PVT use peer-reviewed classical correlations and will be replaced by PhD-era MARS models (2027\u20132029).',
}

// ── Prototype scope boundary — rendered as a disclaimer in the panel ──────────
export const PROTOTYPE_SCOPE = {
  title: 'Prototype Scope & Research Boundary',
  mlComponents: [
    { property: 'CO\u2082-brine IFT', model: 'MARS (MSc research, UTP)', status: 'deployed' as const },
    { property: 'Applicability domain', model: 'Conformal prediction / AD gate (MSc research, UTP)', status: 'deployed' as const },
  ],
  classicalComponents: [
    { property: 'CO\u2082 density', model: 'Span-Wagner (1996) Helmholtz EOS \u2014 42-term multi-parameter (\u00b10.05% vs NIST REFPROP)', phd: false },
    { property: 'CO\u2082 viscosity', model: 'Fenghour et al. (1998) \u2192 Laesecke & Muzny (2017) upgrade pending', phd: false },
    { property: 'CO\u2082 solubility', model: 'Duan-Sun (2003) extended 5-coeff fit + T-dependent Pitzer \u03bb(\u03c4)', phd: true },
    { property: 'Brine density', model: 'Garcia (2001)', phd: true },
    { property: 'Pressure / AoR', model: 'Nordbotten (2005) two-phase composite radial flow', phd: false },
    { property: 'Relative permeability', model: 'van Genuchten\u2013Mualem (1980/1976) + Killough\u2013Land hysteresis', phd: false },
    { property: 'Trapping', model: 'Land (1968) + Killough (1976) imbibition hysteresis', phd: false },
    { property: 'Geomechanics', model: 'Mohr-Coulomb + Biot (standard)', phd: false },
  ],
  phdNote: 'Properties marked \u2605 will be replaced by PhD-era MARS models with calibrated cross-laboratory uncertainty (2027\u20132029).',
}
