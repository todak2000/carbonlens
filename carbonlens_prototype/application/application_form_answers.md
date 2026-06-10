# Competition Application Form — Draft Answers
**Prototypes for Humanity 2026 — Dubai Future Solutions**

---

## Project Title
**CarbonLens: Open-Access CO₂ Storage Simulation for a Decarbonising World**

## One-Line Description
A browser-native, ML-powered geological CO₂ storage simulator that makes rigorous CCS screening accessible to any geologist, regulator, or operator — without a $200,000 software license.

---

## Form Questions

### What is the problem you are addressing?

Geological carbon capture and storage (CCS) is critical to meeting global net-zero targets — the IPCC AR6 identifies CCS as responsible for ~15% of the cumulative CO₂ reductions required by 2050. Yet the software tools needed to screen and assess CO₂ geological storage sites cost between $160,000 and $230,000 per year in licensing fees (CMG-GEM, Petrel, ECLIPSE). This creates a profound access inequality: while the North Sea, Gulf of Mexico, and Australian basins are well-studied and well-funded, countries across the Global South — Nigeria, Indonesia, Malaysia, Egypt, Kenya — have identified billions of tonnes of potential CO₂ storage capacity they cannot afford to evaluate. A geologist at a Nigerian university or a regulator at Indonesia's SKK Migas cannot run a single screening study without an institutional software budget that most developing-world institutions simply do not have.

### How are existing solutions failing?

Enterprise simulators (CMG-GEM, Petrel RE, ECLIPSE) require multi-year licensing agreements, dedicated high-performance workstations, and months of specialist training. A single license costs more than the annual research budget of most universities in Southeast Asia or sub-Saharan Africa. Open-source alternatives — TOUGH2, OpenGeoSys, MRST-co2lab — require command-line expertise, programming knowledge, and weeks of configuration. There is no tool that is simultaneously rigorous, accessible, and free. The result is that developing-world nations are almost entirely absent from the global CCS site assessment literature, not because they lack storage geology, but because they lack accessible tools.

### What is your alternative solution?

CarbonLens is a browser-native CO₂ geological storage simulation studio. It requires no installation, no software license, no specialist hardware, and no programming knowledge. A user opens a URL on any device and, within minutes, can characterise a formation, run a physics-based injection simulation, assess geomechanical safety, evaluate storage economics, and export a jurisdiction-specific permit-ready report.

The tool implements a full multi-physics simulation engine built from peer-reviewed literature: the Span-Wagner (1996) equation of state for CO₂ density, the Duan-Sun (2003) solubility model, the Fenghour et al. (1998) viscosity correlation, Theis (1935) transient radial flow for pressure, Brooks-Corey relative permeability, and the Land (1968) snap-off model for residual trapping. Geomechanical safety is assessed via Mohr-Coulomb failure analysis with Biot poroelastic coupling. A machine learning model developed from CO₂-brine experimental data collected during MSc research at Universiti Teknologi PETRONAS (UTP), Malaysia, predicts interfacial tension — a critical parameter for capillary trapping capacity — across the full supercritical CO₂ regime.

The prototype includes pre-built formation profiles for key Global South basins: Malay Basin (Malaysia), Niger Delta (Nigeria), North Sumatra (Indonesia), and Nile Delta (Egypt), alongside established benchmarks (Sleipner, Gorgon, Mount Simon). Results are validated against the Sleipner CO₂ injection field dataset and the SPE11A benchmark.

### How does it perform better?

A screening workflow that takes 4–6 weeks with enterprise software — procurement, setup, data entry, simulation, report generation — is completed in under one hour with CarbonLens. The physics engine produces equivalent accuracy on storage capacity estimation (P10/P50/P90 uncertainty bounds), geomechanical safety factors, and trapping mechanism breakdown. The tool generates export reports compatible with five regulatory frameworks: US EPA Class VI, EU CCS Directive, Malaysia PETRONAS Technical Standards, Australia OPGGS Act, and Norway NPD.

Critically, CarbonLens runs entirely in the browser with no server infrastructure — meaning it is available offline, deployable on low-bandwidth connections, and accessible in geographies with limited cloud infrastructure.

### What is the impact of your solution?

**Climate:** CarbonLens opens access to geological CCS screening for 50+ nations with identified storage geology but no affordable tools. The IEA estimates that Southeast Asia alone has potential saline aquifer storage capacity exceeding 250 Gt CO₂. Sub-Saharan Africa is estimated at over 100 Gt CO₂. Making these resources assessable accelerates the deployment of CCS infrastructure in regions where it is most needed and currently most absent.

**Communities:** In Nigeria, gas flaring releases approximately 15 Mt CO₂-equivalent annually, directly damaging agricultural land and community health in the Niger Delta. CarbonLens gives Nigerian regulators the tools to evaluate viable CCS alternatives to flaring — a direct community health benefit.

**People:** Every university geoscience department in a developing nation that cannot afford Petrel gains access to a rigorous, citable, peer-validated CCS assessment platform. Researchers, students, and regulators who have been locked out of the global CCS conversation gain a seat at the table.

**Commercial:** The tool creates a clear commercial pathway — a freemium SaaS model where the core simulator remains free and paid tiers provide multi-well optimisation, team collaboration, and API access for enterprise integration. This positions CarbonLens as the reference platform for the $2.5 trillion CCS infrastructure buildout that is projected through 2050.

---

## Supervisor Information
[To be completed with supervisor's name, title, department, and UTP email]

---

*Draft version — for review with supervisor before submission*
