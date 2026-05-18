# Closed-Form MARS Equations with Calibrated Conformal

# Uncertainty for CO₂–Brine Interfacial Tension Prediction

# in Geological Carbon Storage

```
Daniel Olagunju¹, Okorie Ekwe Agwu¹, Muhammad Aslam Md Yusof¹
¹Department of Petroleum Engineering, Universiti Teknologi PETRONAS, Malaysia
Correspondence: daniel_25013118@utp.edu.my
```

**Abstract**

Interfacial tension (IFT) between CO₂ and brine governs capillary trapping in geological
carbon storage (GCS) through the Young–Laplace relation, and a 10% IFT error propagates
directly into capillary entry pressure estimates. Machine learning models for CO₂–brine IFT
have reported test-set R² up to 0.99, but 24 of the 29 ML-IFT studies surveyed here draw test
data by random row-level splitting within the same laboratory dataset; a further three apply
k-fold cross-validation without withholding any laboratory entirely, totalling 28 of 29 that do
not employ cross-laboratory external validation, leaving cross-laboratory generalisation
untested. The present study compares three architectures with contrasting extrapolation
properties, an artificial neural network, multivariate adaptive regression splines (MARS), and
a group method of data handling (GMDH) network on a 3,265-observation dual-regime
corpus from 16 experimental campaigns representing 13 independent research groups. Two
laboratories per regime are withheld as a SHA- 256 - locked external validation (EV) set before
any training. External validation reverses the within-laboratory ranking in both regimes: the
ANN (subcritical test nRMSE = 4.57%) inverts to EV R² = −0.483, and the GMDH diverges
numerically on subcritical EV inputs (nRMSE = 31,999%). MARS is the sole architecture to
generalise, achieving supercritical EV nRMSE = 5.62% (R² = 0.945) and subcritical EV nRMSE
= 17.00%, the residual subcritical gap attributable to a +11.09% apparatus offset at Li et al.
(2012) quantified by a per-laboratory Uncertainty Inflation Factor (UIF = 3.41). Conformal
coverage shortfall confirms distributional non-exchangeability at the offending source.
Closed-form MARS equations (16 terms subcritical, 35 terms supercritical) with all scaler
parameters enable third-party reproduction by arithmetic, and the UIF framework translates
conformal coverage shortfall into deployment-stage interval-widening guidance for cross-
laboratory field application.

**Keywords:** _CO₂–brine interfacial tension; machine learning; external validation; MARS;
conformal prediction; carbon capture and storage_


**1. Introduction**

Geological carbon storage in deep saline aquifers represents the primary engineered sink
for large-scale CO₂ sequestration, and its deployment at the scale required by net-zero
pathways demands credible estimates of storage capacity, injectivity, and long-term
containment integrity. Recent syntheses estimate global saline aquifer storage capacity at
1,000–10,000 Gt CO₂ (Mim et al., 2023; Ajayi et al., 2019), drawing on IPCC and IEA
assessments and sufficient in principle to accommodate multi-decadal industrial
emissions at projected capture rates. The Sleipner project in the Norwegian North Sea,
operating since 1996, provides the longest-running proof of concept, demonstrating
sustained injections of approximately 1 Mt CO₂ yr⁻¹ without detected leakage (Bashir et al.,
2024 ). Realising the full potential of this storage resource requires predictive models that
are accurate, physically interpretable, and validated under conditions that reflect the
heterogeneity of field deployment, including data originating from measurement apparatus
that was not represented during model training.

Interfacial tension (IFT) between injected CO₂ and formation brine is a foundational
thermophysical parameter in GCS reservoir simulation. Thermodynamically, IFT quantifies
the excess Gibbs energy per unit area at the CO₂–brine phase boundary and is expressed in
milli-Newtons per metre (mN m⁻¹). Its operational significance is captured by the Young–
Laplace equation:

## 𝑃!=

## 2 𝛾𝑐𝑜𝑠 𝜃

## 𝑟

where 𝑃! is the capillary entry pressure (Pa), 𝛾 is IFT (mN m⁻¹), 𝜃 is the contact angle, and 𝑟 is
the pore-throat radius (nm). IFT controls all four principal CO₂ trapping mechanisms:
structural trapping, in which IFT determines the capillary pressure threshold that the
caprock must sustain to prevent upward CO₂ migration (Nielsen et al., 2012; Chiquet et al.,
2007 ); residual trapping, in which snap-off and capillary immobilisation of CO₂ ganglia
depend directly on the IFT-governed capillary number (Bachu and Bennion, 2009; Arif et al.,
2016 ); dissolution trapping, in which IFT influences the interfacial mass transfer rate of CO₂
into brine (Iglauer et al., 2012); and mineral trapping, for which IFT plays a secondary role by
mediating the surface contact between dissolved CO₂ and reactive minerals. A 10% error in
IFT propagates directly into capillary entry pressure estimates, with downstream
consequences for storage capacity assessments, injection pressure design, and
containment integrity modelling (Bachu and Bennion, 2009).

Experimental measurement of CO₂–brine IFT has been reported by at least 13 independent
research groups across 16 published experimental campaigns over the past two decades,
collectively spanning pressures from 1.5 to 50 MPa, temperatures from 25 to 175°C, and
brine salinities from pure water to 5 mol kg⁻¹. Pendant-drop and sessile-drop tensiometry
are the two primary measurement methods employed across these studies, and they differ


in droplet geometry, image acquisition hardware, illumination protocols, and edge-
detection algorithms. These instrumental and procedural differences introduce systematic
inter-laboratory offsets: at nominally identical pressure, temperature, and salinity
conditions, IFT measurements from different laboratories can diverge by more than 10%
(Aggelopoulos et al., 2010; Li et al., 2012; Liu et al., 2017; Chalbaud et al., 2009). For
example, comparisons between the Aggelopoulos et al. (2011) and Pereira et al. (2016)
supercritical datasets at overlapping P-T conditions reveal consistent systematic offsets
attributable to apparatus-level effects rather than compositional differences. This inter-
laboratory variability is well documented in the experimental literature, yet it has received
little attention from the machine learning modelling community.

Machine learning models for CO₂–brine IFT prediction have been reported using a range of
architectures, including artificial neural networks (ANNs), support vector machines (SVMs),
gradient boosting machines (GBMs), genetic programming (GP), and group method of data
handling (GMDH) networks (Chen et al., 202 4 ; Amooie et al., 2019; Fan et al., 202 5 ; Pereira
et al., 2016). These models have consistently demonstrated strong predictive accuracy
within the datasets on which they are trained, with test-set R² values typically in the range of
0.95–0.99 across studies. A critical observation arising from the present review, however, is
that 24 of the 29 ML-IFT studies identified draw test data by random row-level splitting from
the same laboratory as training data. Under this protocol, training and test observations
from the same apparatus share systematic measurement offsets, and a model can achieve
low test error by memorising those laboratory-level artefacts without acquiring genuine
predictive skill for data from an unseen source. The distinction between interpolation within
a known laboratory dataset and extrapolation to an unseen apparatus has not been
systematically examined in the existing literature.

Systematic external validation of existing ML-IFT models using independent laboratory data
remains largely unreported. The implicit assumption that test-set accuracy implies field
deployability therefore remains empirically untested for this system. A further concern is
that 28 of the 29 ML-IFT studies identified in the present review (nearly 97%) do not report
uncertainty quantification of any kind, providing no basis for estimating prediction reliability
at deployment conditions that may lie outside the training distribution. These two gaps, the
absence of between-laboratory external validation and the absence of calibrated
uncertainty estimates, constitute the primary motivation for the present work.

The specific contributions of this work are fourfold. First, a complete-laboratory external
validation protocol is employed in which two laboratories per regime are withheld from all
model development and locked by SHA-256 hash prior to training, ensuring that no
information from EV laboratories can influence feature selection, hyperparameter tuning, or
architecture search. Second, three architectures with contrasting extrapolation properties
(a smooth-and-unbounded MLP, a piecewise-linear MARS model, and a polynomial-
divergent GMDH network) are compared head-to-head on the same training–test–EV
partition, exposing a complete reversal of within-laboratory model ranking under cross-
laboratory evaluation. Third, a per-laboratory Uncertainty Inflation Factor (UIF) is introduced


as a deployment-stage diagnostic that translates conformal-coverage shortfalls into
operational interval-widening guidance. Fourth, explicit closed-form MARS equations for
both thermodynamic regimes are reported with all scaler parameters, enabling third-party
reproduction of every IFT prediction by arithmetic alone, and the production equations are
deployed in a publicly accessible web tool with applicability-domain gating and conformal
interval reporting.

The remainder of this paper is organised as follows. Section 2 reviews the experimental,
equation-of-state, and machine learning literature on CO₂–brine IFT prediction. Section 3
describes the dataset, feature engineering, and external validation holdout protocol.
Section 4 details the three model architectures and training procedure. Section 5 presents
all model results including sensitivity and physical compliance analysis. Section 6 reports
the MARS symbolic equations with worked examples. Section 7 evaluates model
performance against three field-scale GCS case studies. Section 8 discusses the findings in
the context of prior literature and practical deployment. Section 9 states the conclusions.

**2. Literature Review**

2.1 Experimental Measurement of CO₂–Brine Interfacial Tension

Experimental determination of CO₂–brine interfacial tension relies principally on two
tensiometric methods, each grounded in distinct physical principles (Zhang and Wang
2023 ). Pendant-drop tensiometry, implemented through Axisymmetric Drop Shape Analysis
(ADSA), suspends a droplet of the denser aqueous phase from a capillary tube inside a
pressurised chamber flooded with the CO₂ phase; the equilibrium drop shape is captured
optically and fitted to the numerical solution of the Young–Laplace equation, yielding IFT as
a single free parameter of the fit (Chiquet et al. 2007; Chalbaud et al. 2009). This method is
preferred for high-pressure and high-temperature conditions representative of geological
carbon storage (GCS) targets because the enclosed chamber design is amenable to
controlled thermodynamic environments up to 70 MPa and 473 K, and the ADSA algorithm
tolerates a wide range of density contrasts between phases (Li et al. 2012; Pereira et al.
2016 ). Sessile-drop tensiometry, by contrast, rests the droplet on a solid substrate and
inverts the geometry, making it more suitable for simultaneous wettability and IFT
characterisation but less tractable at extreme pressures because substrate compliance
and buoyancy corrections become significant (Mutailipu et al. 2019; Yekeen et al. 2021). For
the CO₂–brine system under GCS conditions, pendant-drop ADSA has therefore served as
the overwhelmingly dominant measurement standard across independent laboratory
campaigns.

Over the past two decades, at least sixteen research groups have contributed experimental
CO₂–brine IFT data. Hebach et al. (2002) provided one of the earliest systematic datasets,
spanning 1 to 30 MPa and 20 to 40°C, and demonstrated that density contrast between
phases drives the pressure dependence of IFT. Chalbaud et al. (2009) extended
measurements into NaCl brines across 5 to 25 MPa and 27 to 100°C, confirming an IFT


elevation of approximately 2 to 4 mN m⁻¹ per 1 mol kg⁻¹ NaCl increment. Aggelopoulos et al.
(2010, 2011) made a decisive contribution by isolating the role of divalent cations: their
CaCl₂ series demonstrated that Ca²⁺ induces approximately twice the salting-out increment
per molality unit compared with Na⁺, a mechanistic finding attributable to the stronger
negative adsorption of highly hydrated divalent cations from the interface. Georgiadis et al.
(2010) provided arguably the most rigorously characterised pure-water dataset, spanning 1
to 60 MPa across five isotherms with formally stated expanded uncertainties at 95%
confidence, and Li et al. (2012) generated 134 data points across mixed NaCl, KCl, and
Na₂SO₄ brines, though a systematic apparatus offset of approximately 3 mN m⁻¹ relative to
contemporaneous studies has been identified in the present work. Chow et al. (2016) and
Pereira et al. (2016, 2017) extended the database to simultaneous in-situ density
measurement and to mixed NaCl–CaCl₂ brines, respectively. Liu et al. (2017) produced the
largest single-source dataset of 1,254 points spanning 5 to 50 MPa and 30 to 150°C in NaCl
brine, which currently accounts for 38.4% of the pooled dataset used in the present study.
Mutailipu et al. (2019) contributed supercritical-regime observations up to 50 MPa and
120°C.

Two robust thermophysical patterns emerge from this body of work. Pressure exerts the
most pronounced influence: IFT declines sharply from values exceeding 60 mN m⁻¹ at
ambient conditions to approximately 20 to 30 mN m⁻¹ near the CO₂ critical pressure of 7.
MPa, after which it approaches a pseudo-plateau and becomes relatively insensitive to
further pressure increments. Temperature effects are non-monotonic, particularly near the
CO₂ critical temperature of 304.13 K, where a local IFT minimum is frequently observed
before values recover at higher supercritical temperatures. Salinity consistently elevates IFT
through the salting-out mechanism, with divalent cation systems (CaCl₂, MgCl₂) producing
increments approximately double those of monovalent equivalents at equal molality. Gas
impurities exert divergent effects: CH₄ and N₂ reduce the solubility of CO₂ in brine and
increase IFT by 2 to 6 mN m⁻¹ per 10 mol% substitution, whereas SO₂ and H₂S increase gas-
phase density and depress IFT by comparable magnitudes.

Despite this accumulation of data, a persistent inter-laboratory scatter problem remains
inadequately resolved. Measurements taken by independent groups at nominally identical
pressure, temperature, and salinity conditions diverge by more than 10% of the measured
value, corresponding to absolute discrepancies of 2 to 7 mN m⁻¹, attributable to differences
in equilibration duration, ADSA algorithm parameterisation, phase density sources, and
capillary geometry. **Table 1** synthesises the critical appraisal of major experimental
campaigns to identify the structural origins of this scatter.

```
Table 1. Critical appraisal of major experimental studies on CO₂–brine IFT measurement.
```

**Reference Method P range (MPa)**

```
T
range
(°C)
```
```
Brine
system n^ Key limitation^
```
Hebach et al. (2002) Pendantdrop - 1 – 30 20 – 40 H₂O, NaCl - Limited temperature range; pure water dominant

Chalbaud et al. (2009) Pendantdrop/ADSA- 5 – 25 27 – 100 NaCl - Single salt type; narrow salinity range

Aggelopoulos et al. (2010) Pendantdrop - 8 – 20 27 – 60 CaCl₂, MgCl₂ 54 Subcritical only; limited pressure range

Aggelopoulos et al. (2011) Pendant-
drop

```
8 – 20 35 – 75 NaCl,
CaCl₂
```
```
48 Limited data points; narrow
conditions
```
Li et al. (2012) Pendantdrop - 5 – 20 25 – 70 NaCl, KCl, Na₂SO₄ 134 Systematic apparatus offset identified in present study

Liu et al. (2017) Pendantdrop - 5 – 50 30 – 150 NaCl 1,254 NaCl only; dominates pooled datasets (38.4%)

Pereira et al. (2016) Pendantdrop - 10 – 30 35 – 60 NaCl 44 NaCl only; limited brine diversity

Mutailipu et al. (2019)

```
Pendant-
drop 10 –^50 35 –^120 NaCl^ -^
```
```
Supercritical only; NaCl
dominant
ADSA: Axisymmetric Drop Shape Analysis; n: number of data points reported; - : not precisely specified in
source publication.
```
```
Table 1 reveals two structural imbalances that compound the measurement heterogeneity
problem. First, the experimental database is dominated by NaCl-brine experiments, with
divalent-cation systems (CaCl₂, MgCl₂) and mixed-anion brines (containing SO₄²⁻ or Cl⁻–
SO₄²⁻ mixtures) accounting for fewer than 15% of available observations across all
published campaigns. This monoionic bias is consequential: because the salting-out
increment of divalent cations is approximately twice that of monovalent cations per
equivalent molality, a pooled dataset skewed toward NaCl brine will systematically
underrepresent the thermodynamic behaviour of Ca²⁺- and Mg²⁺-rich formation waters that
characterise deep carbonate and evaporite aquifers. Machine learning models trained on
such an unbalanced dataset inherit this representational gap and may therefore
underestimate IFT in divalent-dominated reservoirs without any indication of out-of-
distribution prediction.
```
```
Second, the inter-laboratory measurement heterogeneity documented in Table 1 creates a
structured rather than random noise floor in any pooled experimental database.
Specifically, Bikkina et al. (2011) demonstrated that non-equilibrated measurements
produce a systematic overestimation of 5 to 7 mN m⁻¹ relative to equilibrated values at
identical conditions, and the present study identifies a comparable apparatus-specific
```

offset of approximately 3 mN m⁻¹ in the Li et al. (2012) dataset. Because these offsets are
correlated with laboratory identity rather than distributed randomly, a machine learning
model trained on a pooled database will, under a random row-level split protocol, encounter
training and test observations from the same apparatus in proportional frequency. The
model can therefore achieve low test error by learning laboratory-specific offsets rather than
the underlying thermophysical relationship, inflating reported accuracy metrics without
acquiring genuine cross-laboratory predictive skill. These instrumental and methodological
differences collectively impose a structured heterogeneity on any pooled experimental
database, a heterogeneity that classical regression and equation-of-state approaches have
addressed with varying success.

2.2 Equation-of-State and Regression Approaches

Classical predictive approaches for CO₂–brine IFT fall into three physically distinct
categories that differ in their treatment of interfacial thermodynamics. Linear Gradient
Theory (LGT) treats the fluid–fluid interface as a continuous density profile and evaluates the
interfacial free energy through an influence-parameter integral coupled to a bulk equation
of state. The Parachor correlation, originating from the empirical work of Macleod (1923) and
formalised by Sugden (1924), relates IFT to the density difference between co-existing
phases through the Macleod–Sugden relation:

## 𝛾"/$=.

```
%
```
## [𝑃%](𝑐%&−𝑐%')

where [𝑃%] is the parachor parameter of component 𝑖 and 𝑐%&, 𝑐%' are molar concentrations in
the liquid and vapour phases respectively. The Parachor approach offers computational
simplicity but requires accurate mutually saturated phase densities as secondary inputs,
introducing a cascading uncertainty when the underlying equation of state is imprecise.
Empirical regression correlations, including the polynomial fits of Hebach et al. (2002) and
the power-law forms of Bachu and Bennion (2009), directly fit IFT as a function of
macroscopic state variables. At the physically grounded extreme, SAFT-VR Mie and density
functional theory approaches resolve interfacial structure from molecular parameters,
providing interpolative accuracy within their parameterisation range at the cost of requiring
component-specific binary interaction parameters.

**Table 2** provides a critical appraisal of representative EoS and regression approaches,
highlighting their physical basis and documented limitations.

```
Table 2. Critical appraisal of EoS and regression approaches for CO₂–brine IFT.
```

**Reference Approach Physical basis P–T range Performance Key limitation**

Hebach et al. (2002) Regression correlation

```
Density
difference
empirical fit
```
```
0.1– 20
MPa,
278 – 335
K
```
```
AARE ~9.75%
at broad
conditions
```
```
Pure water only; fails outside
calibration P–T range
```
Bachu and Bennion
(2009)

```
Power-law
regression
```
```
Macroscopic
state variable fit
```
```
2 – 27
MPa,
293 – 398
K
```
```
Acceptable
near
calibration
range
```
```
Fails to reproduce non-
monotonic T dip near critical
point
```
Chalbaud et al. (2009) Parachor method

```
Macleod–Sugden
density-
difference scaling
```
```
4.5–25.
MPa,
300 – 373
K
```
```
~16.7% error
outside
calibration
```
```
Understates IFT at low P;
requires accurate phase
densities
```
Chiquet et al. (2007) LGT/EoS

```
Density gradient
theory with
equation of state
```
```
5 – 45
MPa,
308 – 383
K
```
```
Good within
pure-water
calibration
```
```
Pure water only; brine extension
requires re-parameterisation
```
Mutailipu et al. (2019) Regression correlation

```
Valence-
weighted molality
fit
```
```
3 – 15
MPa,
298 – 373
K
```
```
AARE 18.6%
below 55 MPa
```
```
Phase density neglected; high
error near phase boundary
```
Zhang and Wang (2023) Systematic EoS review

```
Multiple
thermodynamic
frameworks
```
```
Broad
coverage
```
```
Synthesis
study; no new
model
```
```
No ML component; extrapolation
limits unquantified
```
```
AARE: Average Absolute Relative Error; LGT: Linear Gradient Theory; P: pressure; T: temperature. Each
reference is primarily an experimental measurement campaign, the reported AARE corresponds to an auxiliary
empirical correlation fitted by the authors to their own measurement data and is not a measurement
uncertainty.
```
```
EoS and regression approaches share a fundamental limitation that is independent of their
physical sophistication: all require empirical constant fitting to experimental data from one
or a small number of laboratories, and the resulting constants absorb apparatus-specific
biases alongside genuine thermophysical signal. When applied to data from a different
laboratory or a different brine composition, these constants no longer optimally represent
the physical system, and prediction errors escalate sharply. Chalbaud et al. (2009) report
errors exceeding 16.7% when their Parachor model is applied outside its NaCl calibration
range, and the Li et al. (2012) regression predicts physically impossible negative IFT values
below 2 MPa due to polynomial divergence. Furthermore, LGT and SAFT-VR Mie frameworks
require component-specific influence parameters and binary interaction parameters that
must be re-fitted for each new brine salt, making them impractical for the wide
compositional diversity of real formation waters. These extrapolation failures and
compositional rigidities establish the practical ceiling of classical approaches and motivate
```

```
the transition to data-driven machine learning methods that can, in principle, absorb
broader thermodynamic variation without committing to fixed functional forms.
```
```
2.3 Machine Learning Approaches
```
```
2.3.1 Black-Box Architectures
```
```
Machine learning models entered the CO₂–brine IFT literature with the pioneering
application of a multilayer perceptron (MLP) artificial neural network by Zhang et al. (2016),
who demonstrated that a six-input, two-hidden-layer architecture trained on 1,716 data
points outperformed existing empirical correlations with an R² of 0.982. The decade that
followed produced a rapid proliferation of architectures: radial basis function networks,
least-squares support vector machines (LSSVM) with metaheuristic optimisation, adaptive
neuro-fuzzy inference systems (ANFIS), random forests, extreme gradient boosting
(XGBoost), LightGBM, multibranch convolutional neural networks (CNN), and stacking
ensemble super learners. Across 25 black-box studies identified in the present review,
reported test-set R² values cluster between 0.95 and 0.999, with training dataset sizes
ranging from 107 to 3,265 observations and input feature counts ranging from 3 to 8
variables encompassing pressure, temperature, salinity measures, phase density
difference, and gas impurity fractions.
```
```
This landscape of high reported accuracy conceals the methodological deficiencies
identified in Section 1: specifically, the lack of cross-laboratory external validation (absent
in 28 of 29 studies) and the absence of uncertainty quantification (absent in 97% of studies).
As established in Section 2.1, training and test observations drawn from the same apparatus
share systematic measurement offsets. Models evaluated under within-distribution
random splitting protocols can achieve low test error by fitting these laboratory-specific
offsets without acquiring genuine predictive skill for unseen sources. The inflated R² values
reported in Table 3 therefore largely reflect the memorisation of dataset structure rather
than the generalisation of thermophysical relationships.
```
```
Table 3 presents a critical appraisal of representative black-box ML studies, enabling direct
comparison with the present study's cross-laboratory external validation results.
```
```
Table 3. Performance of black-box ML models for CO₂–brine IFT prediction (selected
studies).
```
**Reference Architecture Dataset (n) Inputs Best test R²**

```
EV
protoco
l
```
```
UQ Explicit equation
```
Amooie et al.
(2019)

```
MLP-ANN
(CMIS
ensemble)
```
```
~2,517 P, T, MCM, BCM, Tcm Not reported Random split No No
```

**Reference Architecture Dataset (n) Inputs Best test R²**

```
EV
protoco
l
```
```
UQ Explicit equation
```
```
(AAPRE:
3.06%)
```
Zhang et al.
(2020a) XGBoost^ ~2,^

```
P, T, MCM, BCM,
xCH₄, xN₂, Δρ 0.^
```
```
Random
split No^ No^
```
Fan et al. (2025) Multibranch CNN ~1,716 P, T, MCM, BCM, xCH₄, xN₂ 0.992 Random split No No

Amar et al. (2025)

```
Super Learner
(stacking
ensemble)
```
```
~2,
```
```
P, T, MCM, BCM,
xCH₄, xN₂, Δρ 0.^
```
```
Random
split No^ No^
```
Turkson et al.
(2026)

```
XGBoost +
Grey Wolf
optimiser
```
```
3,265 P, T, MCM, BCM, xCH₄, xN₂, Δρ 0.983 Kexternal-fold + Yes No
```
```
n: total dataset size; MCM: monovalent cation molality; BCM: bivalent cation molality; Tcm: pseudocritical
temperature of gas mixture; EV: external validation; UQ: uncertainty quantification; MC: Monte Carlo; Sup EV:
supercritical cross-laboratory external validation set. Turkson et al. (2026) report k-fold cross-validation plus
a held-out test set drawn from the same pooled database; no complete-laboratory cross-boundary EV R² is
reported.
```
```
Two systematic consequences of within-laboratory splitting are evident from Table 3. First,
the reported test R² values for models trained on 2,000 to 3,265 observations cluster tightly
between 0.983 and 0.995, suggesting an accuracy plateau that reflects the measurement
noise floor of the pooled database rather than any genuine architectural superiority. When
the present study applies a cross-laboratory external validation protocol to the ANN
architecture, the supercritical test R² falls to 0.967, a materially lower figure that more
accurately represents predictive skill on data from an unseen apparatus. This gap between
within-laboratory test accuracy and cross-laboratory external validation accuracy confirms
that published black-box performance metrics are systematically optimistic. Second, the
absence of probabilistic uncertainty bounds in all but one of the reviewed studies
constitutes a deployment barrier for regulatory applications: geological carbon storage site
approval frameworks in jurisdictions including Norway, the United Kingdom, and the
European Union require probabilistic caprock integrity assessments expressed as P10, P50,
and P90 bounds, which deterministic point predictions cannot supply. The interpretability
deficit is equally consequential for field deployment: because black-box architectures
encode predictions in weight matrices or ensembles of thousands of decision trees, their
predictions cannot be audited against physical expectations, reproduced in standard
reservoir simulation environments without specialised software, or transcribed into the
spreadsheet tools routinely used by field engineers.
```

```
Split conformal prediction (Vovk et al. 2005; Angelopoulos and Bates 2023) provides a
distribution-free, model-agnostic framework for constructing prediction intervals with
finite-sample marginal coverage guarantees under the exchangeability assumption that
calibration and test data are drawn from the same distribution. Under non-exchangeability
for example, when test data originate from a measurement apparatus not represented in
calibration, the empirical coverage on the test set will fall systematically below the nominal
level, providing a formal statistical signal of distributional shift. This makes conformal
prediction particularly well suited to the cross-laboratory deployment problem framed in
this work: a coverage shortfall on the EV set directly quantifies the inadequacy of test-
calibrated intervals for unseen-apparatus inputs. To the best of our knowledge, conformal
prediction has not previously been applied to CO₂–brine IFT modelling; the present work
adopts it as the uncertainty-quantification framework alongside the architectural
comparison.
```
```
2.3.2 Transparent/White-Box Architectures
```
```
Transparent machine learning approaches for CO₂–brine IFT aim to deliver the predictive
advantages of data-driven modelling alongside explicit, human-readable mathematical
equations that can be independently verified, transcribed into reservoir simulators, and
checked for thermodynamic consistency. The principal architectures employed in the
literature include Multivariate Adaptive Regression Splines (MARS), Group Method of Data
Handling (GMDH), Multi-Gene Genetic Programming (MGGP), and Gene Expression
Programming (GEP). MARS constructs piecewise linear hinge functions with automatically
determined knot positions, expressing IFT as a sum of basis function products that can be
written as a compact algebraic formula. GMDH evolves nested polynomial networks
through a layer-wise self-organisation algorithm, producing a hierarchical but fully explicit
polynomial expression. MGGP and GEP extend standard genetic programming by evolving
symbolic expression trees, with MGGP combining multiple gene-tree outputs through linear
regression to improve parsimony.
```
```
Table 4 provides a critical appraisal of representative transparent ML studies, again
enabling direct comparison with the present study.
```
```
Table 4. Performance of transparent/white-box ML models for CO₂–brine IFT prediction
(selected studies).
```
**Reference Architecture Dataset (n) Test R² EV protocol UQ Explicit equation**

Kamari et al. (2017) GEP 1,716 0.640 Random split No Yes

Amooie et al. (2019) GMDH 2,517 N.R Random split No Yes (nested polynomial)


**Reference Architecture Dataset (n) Test R² EV protocol UQ Explicit equation**

Amar (2021) GP (stratified by T) 2,346 0.952 Random split No Yes
(piecewise)

Chen et al. (2024) GMDH 2,811 0.894 Random split + k-fold No Yes (nested polynomial)

Chen et al. (2024) GEP 2,811 0.871 Random split + k-fold No Yes

Davari and Bigdeli
(2025)

```
Symbolic
Regression (SR) 1,830^ 0.^
```
```
Random split +
k-fold No^ Yes^
n: total dataset size; EV: external validation; UQ: uncertainty quantification; Sup EV: supercritical cross-
laboratory external validation set. N.R: Not Reported
```
```
Table 4 reveals a critical pattern that the black-box literature obscures: transparent models
evaluated under genuinely stringent validation conditions achieve R² values that are
numerically competitive with the most sophisticated black-box architectures evaluated
under within-laboratory splitting. Nevertheless, prior white-box implementations share two
unresolved limitations: all rely on within-laboratory random splits, and none provide
probabilistic uncertainty quantification capable of supporting the P10/P50/P90 risk bounds
required for regulatory deployment.
```
**3. Data and Preprocessing**

```
3.1 Dataset Composition
```
```
The compiled dataset comprises 3,265 CO₂–brine interfacial tension (IFT) observations
sourced from 16 published experimental campaigns, reported by approximately 13
independent research groups (Aggelopoulos et al. 2010 + 2011 , Liu et al. 2016 + 2017 , and
Pereira et al. 2016 + 2017 represent paired publications from the same respective groups;
the remaining ten publications represent distinct research groups). It spans a measurement
period from approximately 2000 to 2024 and representing the most comprehensive multi-
laboratory corpus assembled for CO₂–brine IFT modelling to date. Experimental conditions
cover pressures of 1.5–50 MPa, temperatures of 25–175°C, and total brine salinity of 0–5 mol
kg⁻¹, encompassing monovalent (NaCl, KCl), divalent (CaCl₂, MgCl₂), anion-rich (Na₂SO₄),
and mixed brine chemistries. A subset of 204 observations includes dissolved N₂ and 307
observations include dissolved CH₄, representing CO₂ streams of sub-pipeline purity
relevant to post-combustion and pre-combustion capture scenarios. No duplicate
observations were identified in the raw data; twenty-four rows from Na₂SO₄ brine
experiments required reclassification of salinity from the divalent cation column to the
anion column to maintain ionic species consistency, and no other quality interventions were
required.
```

```
The laboratory contributions are summarised in Table 5. Each row corresponds to a distinct
experimental campaign; pressure and temperature ranges, primary brine chemistry, and
partition role are reported for each source. Where observation counts or operating
envelopes could not be confirmed from primary sources, entries are marked with a dash to
avoid fabrication of exact values; however, the aggregate totals and EV laboratory counts
are exact.
```
```
Table 5. Dataset composition: 16 published experimental campaigns, observation counts,
thermodynamic regime, operating conditions, and brine type.
```
**Reference Regime** 𝑃 **range (MPa)** 𝑇 **range (°C) Primary salt Role**

Aggelopoulos et al. (2010) Sub 8 – 20 27 – 60 CaCl₂ Sub EV

Aggelopoulos et al. (2011) Sup 8 – 20 35 – 75 NaCl, CaCl₂ Sup EV

Bikkina et al. (2011) Sub/Sup 1.5– 30 25 – 50 NaCl Train/Test

Chalbaud et al. (2009) Sub/Sup 5 – 25 27 – 100 NaCl Train/Test

Chow et al. (2016) Sup 10 – 35 50 – 100 NaCl + N₂/CH₄ Train/Test

Georgiadis et al. (2010) Sub/Sup 2 – 60 25 – 120 H₂O Train/Test

Hebach et al. (2002) Sub 1.5– 15 25 – 50 H₂O, NaCl Train/Test

Kvamme et al. (2007) Sub 5 – 20 25 – 40 H₂O Train/Test

Li et al. (2012) Sub 5 – 20 25 – 70 NaCl, KCl, Na₂SO₄ Sub EV

Liu et al. (2016) Sup 5 – 50 35 – 150 NaCl Train/Test

Liu et al. (2017) Sup 5 – 50 30 – 150 NaCl Train/Test

Mutailipu et al. (2019) Sup 10 – 50 35 – 120 NaCl Train/Test

Pereira et al. (2016) Sup 10 – 30 35 – 60 NaCl Sup EV

Pereira et al. (2017) Sub/Sup 5 – 30 35 – 75 NaCl Train/Test

Ren et al. (2000) Sub 1.5– 10 25 – 50 H₂O, CH₄ Train/Test

Yan et al. (2001) Sub/Sup 5 – 25 25 – 80 H₂O, N₂ Train/Test

```
Three structural features of Table 5 warrant explicit attention before model development
proceeds. First, Liu et al. (2017) alone contributes 1,254 observations, equivalent to 38.4%
of the total dataset; this single-source concentration means that supercritical NaCl-brine
measurements at moderate-to-high pressures are substantially overrepresented in the
training distribution, and any model that performs well in this subdomain will appear strong
on aggregate test metrics regardless of its behaviour elsewhere. Second, coverage of
```

divalent cation chemistry is sparse: CaCl₂ and MgCl₂ brine measurements are confined to a
small number of laboratories, and the divalent subcritical domain is populated almost
entirely by Aggelopoulos et al. (2010), which is withheld as EV, meaning the training pool
contains negligible divalent subcritical data. Third, SO₄²⁻ chemistry is confined to a single
laboratory (Li et al., 2012), which is also withheld as EV, rendering the anion molality feature
(ACM) zero-variance in both training pools and necessitating its exclusion from the model
feature set. These three distributional asymmetries are the direct motivation for the external
validation design described in Section 3.4: a model selected on test-set accuracy will be
optimised for the Liu et al. (2017) subdomain and may fail systematically on the divalent-
cation and anion-chemistry conditions that constitute the EV sets.

3.2 Thermodynamic Regime Classification

Observations are partitioned into thermodynamic regimes based on a two-dimensional
critical point boundary. The supercritical regime is strictly defined as observations where
both temperature and pressure exceed their effective critical values (𝑇>𝑇!,eff and 𝑃>
𝑃!,eff). The subcritical regime comprises all remaining observations (𝑇≤𝑇!,eff OR 𝑃≤𝑃!,eff),
which encompasses three distinct physical sub-states: compressed liquids (𝑇<
𝑇!,eff and 𝑃≥𝑃!,eff), two-phase mixtures (𝑇<𝑇!,eff and 𝑃<𝑃!,eff), and hot gases (𝑇≥
𝑇!,eff and 𝑃<𝑃!,eff).

The effective critical properties are computed using Kay's mixing rule to account for
dissolved CH$ and N):

```
𝑇!,eff=𝑥CO!𝑇!,CO!+𝑥CH"𝑇!,CH"+𝑥N!𝑇!,N!
```
```
𝑃!,eff=𝑥CO!𝑃!,CO!+𝑥CH"𝑃!,CH"+𝑥N!𝑃!,N!
```
with pure-component properties: 𝑇!,CO!= 304. 13 K, 𝑇!,CH"= 190. 56 K, 𝑇!,N!= 126. 19 K;
and 𝑃!,CO!= 7. 377 MPa, 𝑃!,CH"= 4. 599 MPa, 𝑃!,N!= 3. 390 MPa. After regime assignment,
the dataset contains 1,400 subcritical and 1,865 supercritical observations. Because the
hot gas sub-state is retained in the subcritical pool, subcritical observations can exhibit
reduced temperatures (𝑇*=𝑇/𝑇!,eff) substantially greater than 1.0 (reaching up to 2.217 in
this dataset), particularly for N)-rich mixtures where Kay's rule dramatically lowers the
effective critical temperature.

The physical distinction between the two regimes is consequential for model structure. In
the subcritical regime, the CO)-rich phase exhibits a relatively high density contrast against
brine, yielding characteristically higher IFT values (15–79 mN m⁻¹) that are highly sensitive
to phase state transitions. In the supercritical regime, CO) density increases sharply with
pressure, compressing the density contrast and driving IFT into a narrower range (14–40 mN
m⁻¹) with weaker and more nearly linear pressure dependence. These mechanistic
differences necessitate dual-regime modelling, with separate architectures and scalers for


each partition to avoid representing two qualitatively distinct response surfaces with a
single function.

**Figure 1** presents the pressure–temperature distribution of all 3,265 observations coloured
by thermodynamic regime, illustrating the density of supercritical measurements relative to
subcritical.

```
Figure 1. Pressure–temperature scatter plot of all 3,265 CO₂–brine IFT observations
```
The supercritical observations are concentrated in the pressure range 5–50 MPa and
temperature range 30–150°C, consistent with the dominant contribution of Liu et al. (2017).
The subcritical observations occupy a lower-pressure, lower-temperature envelope and
exhibit greater scatter in the 𝑃–𝑇 plane, reflecting the more diverse experimental campaigns
represented in that partition.

3.3 Feature Engineering

Ten features were constructed from the raw observational variables to represent the
physical determinants of CO₂–brine IFT in dimensionless or physically interpretable form.
The feature construction strategy follows three principles: (i) physical grounding, so that
each feature corresponds to a mechanism with a known IFT effect; (ii) parsimony, so that
correlated features encoding the same mechanism are not duplicated; and (iii) regime-
agnostic definition, so that the same feature set can be used in both the subcritical and


```
supercritical model without modification, enabling direct comparison of model behaviour
across regimes. The resulting features are described in Table 6.
```
```
Table 6. Feature set used for model training in both regimes.
```
**No. Feature Symbol Definition Physical justification**

1 Reduced pressure 𝑃#^ 𝑃/𝑃$,&''^

```
Dimensionless thermodynamic state variable; encodes
pressure effect on CO₂ density via the principle of
corresponding states, enabling transfer across gas mixtures
of different critical properties
```
2 Reduced temperature 𝑇#^ 𝑇^ [𝐾]/𝑇$,&''^ [𝐾]^

```
Dimensionless temperature; governs CO₂ phase behaviour
and density; the primary driver of the subcritical–
supercritical transition boundary
```
3

```
Density
difference
squared
```
## 𝛥𝜌^2 (𝜌𝐶𝑂 2 )^2

```
Direct physical IFT driver from the Macleod–Sugden parachor
correlation; 𝛾+/-∝(𝑐(/)−𝑐(^1 )), so 𝛾∝(𝛥𝜌)- to leading
order; 𝛥𝜌^2 captures the dominant nonlinearity
```
4 Monovalent molality MCM mol kgequivalent⁻¹ NaCl -

```
Represents the salting-out effect of monovalent cations
(Na⁺, K⁺) on CO₂ solubility through electrostatic hydration;
reduces CO₂ activity in the aqueous phase and elevates IFT
```
5 Divalent molality BCM mol kgequivalent⁻¹ CaCl₂ -

```
Represents the stronger salting-out effect of divalent cations
(Ca²⁺, Mg²⁺) through ion–dipole interactions with interfacial
water molecules; encoded separately from MCM because
divalent ions produce a markedly stronger IFT elevation per
unit ionic strength
```
6 CH₄ mole fraction 𝑥^23 "^ Mol% Gasgas phase and modifies the gas-phase co-solvent; methane reduces CO₂ activity in the –brine density contrast

7 N₂ fraction mole 𝑥^4 #^ mol/%

```
Gas-phase co-solvent; nitrogen has lower solubility in brine
than CO₂ and produces a different density trajectory with
pressure
```
8 Divalent binary flag BCM_bin 1 [𝐵𝐶𝑀>^0 ]^

```
Enables piecewise model response to the presence or
absence of divalent cations; captures a qualitative salinity-
type effect independent of magnitude
```
9 CH₄ binary flag CH4_bin 1 [𝑥^23 ">^0 ]^

```
Marks observations with a mixed gas phase; allows a
structural break in the model response surface at the pure
CO₂ boundary
```
10 N₂ binary flag N2_bin 1 [𝑥^4 #>^0 ]^ Analogous to CH4_bin for nitrogen-containing gas mixtures


Four post-construction decisions merit explanation. First, 𝛥𝜌) is designated the dominant
feature on physical grounds: the Macleod–Sugden parachor relation establishes that 𝛾"/$ is
proportional to the molar concentration difference between phases, which scales with
density difference, making 𝛥𝜌) the most direct algebraic encoding of the principal IFT driver.
Second, MCM and BCM are encoded as separate features rather than a combined ionic-
strength variable because the IFT elevation per unit molality is empirically higher for divalent
cations; conflating the two species would force a single coefficient onto mechanistically
distinct salting-out pathways. Third, ACM (SO₄²⁻ anion molality) was evaluated as a
candidate feature but excluded: all 24 Na₂SO₄ observations originate from Li et al. (2012),
which is withheld entirely in the subcritical external validation set, leaving ACM with zero
variance in both training pools after the EV lock; including a zero-variance feature would
contribute no information to training and would degrade model conditioning without benefit.
Fourth, variance inflation factor (VIF) analysis was conducted on the seven candidate
continuous features using the training data for each regime. In the subcritical regime, VIF
scores were: 𝑃* = 6.89, 𝑇* = 31.18, MCM = 1.69, BCM = 1.07, 𝑥+," = 1.22, 𝑥-! = 1.46,
and 𝛥𝜌) = 15.65. In the supercritical regime, VIF scores were: 𝑃* = 9.20, 𝑇* = 22.33, MCM =
2.01, BCM = 1.63, 𝑥+," = 1.45, 𝑥-! = 1.40, and 𝛥𝜌) = 10.31. The maximum non-anchored VIF
across both regimes was 2.01 (MCM, supercritical), which falls below any conventional
multicollinearity threshold; no feature was dropped by VIF screening. The three physically
anchored features 𝑃*, 𝑇*, and 𝛥𝜌) were designated exempt from VIF-based elimination by
design, as their physical necessity is independent of their correlational structure.

**Figure 2** and **Figure 3** presents the Pearson correlation matrix of all candidate features
against IFT, motivating the feature prioritisation described above.


**Figure 2.** Pearson correlation matrix of candidate features and IFT for the subcritical
training pool


```
Figure 3. Pearson correlation matrix of candidate features and IFT for the supercritical
training pool
```
The correlation analysis confirms that 𝛥𝜌) and 𝑇* carry the strongest individual linear
associations with IFT, while the salinity features MCM and BCM contribute positive but
weaker marginal correlations consistent with the salting-out mechanism. The gas-phase
composition features 𝑥+," and 𝑥-! show near-zero marginal correlation with IFT, reflecting
the small proportion of observations with impure CO₂ streams, but their inclusion is retained
on physical grounds and confirmed by MARS term selection in the supercritical regime.

3.4 External Validation Holdout Design

Conventional random train–test splits share apparatus-level biases between training and
evaluation observations, producing metrics that reflect within-laboratory interpolation
accuracy rather than cross-laboratory generalisation (Section 2.1). For predictive
deployment in GCS assessment, the model will be queried with data from instruments not
represented in training; within-laboratory test metrics are therefore an inadequate criterion
for production model selection.

The external validation (EV) holdout design follows four principles, each of which addresses
a specific failure mode of conventional splitting.

1. **Complete-laboratory exclusion.** Each EV set contains all observations from the
    selected laboratories; no row-level random split is applied within EV laboratories.
    This principle is necessary because partial inclusion of a laboratory's data in training
    would expose the model to that laboratory's systematic measurement signature
    during fitting, removing the methodological independence that constitutes genuine
    external validation.
2. **Salt-type coverage.** EV laboratories are selected to represent brine chemistries
    underrepresented in the training pool, specifically divalent cation systems (CaCl₂
    and Na₂SO₄) absent or sparsely covered in the dominant training source. This
    principle ensures that the EV set exercises prediction in input regions where training
    coverage is genuinely sparse, rather than confirming interpolation accuracy in well-
    covered regions.
3. **Pre-training lock.** The EV set composition is fixed by SHA-256 hash of the holdout
    data file prior to the commencement of any model training, and the EV evaluation
    script is not executed during the development phase. The hash provides
    cryptographic evidence that EV data were not consulted, inadvertently or otherwise,
    during architecture search, hyperparameter selection, or feature engineering.
4. **Assessment only.** The EV set is used exclusively to evaluate the production models
    reported in this paper. It plays no role in hyperparameter selection, architecture
    search, regularisation, or early stopping. Any procedure that reads EV predictions for


```
a decision affecting model structure constitutes data leakage and is explicitly
prohibited.
```
The resulting partition is summarised in **Table 7**. The subcritical EV set (Li et al., 2012, 𝑛=
134 ; Aggelopoulos et al., 2010, 𝑛= 54 ) covers NaCl, KCl, and Na₂SO₄ brines at subcritical
pressures and temperatures. The supercritical EV set (Aggelopoulos et al., 2011, 𝑛= 48 ;
Pereira et al., 2016, 𝑛= 44 ) provides independent supercritical NaCl and NaCl+CaCl₂
measurements from other laboratory campaigns.

```
Table 7. Data partitioning by regime.
```
```
Regime Training Test External Validation Total (regime)
Subcritical 965 247 188 1,400
Supercritica
l 1,417^356 92 1,865^
Combined 2,382 603 280 3,265
```
The subcritical EV set represents 13.4% of the subcritical pool and covers brine chemistries
(CaCl₂, Na₂SO₄, KCl) that are underrepresented in the training distribution; 93 of the 188
subcritical EV observations have BCM > 0, ensuring that the EV set specifically exercises
divalent-brine prediction for which training coverage is limited, making the subcritical EV a
genuinely challenging out-of-distribution test. The supercritical EV set is smaller in absolute
and relative terms (4.9% of the supercritical pool), reflecting the limited number of
independent supercritical laboratories available outside the dominant Liu et al. (2017)
corpus. This asymmetry means that subcritical EV performance carries greater diagnostic
weight: the subcritical EV set represents a more severe distribution shift, and performance
degradation in that partition is more likely to reflect structural model limitations than
sampling variability.

3.5 Stratification and Distributional Validation

Within-regime stratification of training and test sets is performed using a stratified shuffle
split over the four primary anchor features (𝑃*, 𝑇*, 𝛥𝜌), MCM), divided into quantile-based
strata. This approach ensures that the training and test partitions are drawn from equivalent
marginal distributions in the thermodynamically and chemically most important
dimensions, preventing the test set from systematically over-representing extreme
pressure, temperature, or salinity conditions. Stratification is executed on the post-EV-
exclusion pool (training plus test only); the EV sets are never involved in stratification.

Distributional equivalence between training and test partitions is verified using the two-
sample Kolmogorov–Smirnov (KS) test under a two-gate protocol. The hard gate
(significance level 𝛼= 0. 001 ) is applied to the four anchor features 𝑃*, 𝑇*, 𝛥𝜌), and MCM;
rejection of the null hypothesis of equal distributions for any anchor feature would invalidate


the split and trigger re-stratification. The advisory gate (𝛼= 0. 05 ) is applied to BCM, 𝑥+,",
and 𝑥-!, which are zero-inflated; representativeness for these features is enforced through
binary-flag stratification rather than the continuous KS test. ACM is skipped in both regimes
owing to zero variance.

The KS statistics for the accepted splits are reported convincingly in both regimes, with 𝑝-
values well above 0.001. The subcritical hard-gate results are: 𝑃*, KS = 0.032 (𝑝= 0. 982 ); 𝑇*,
KS = 0.069 (𝑝= 0. 290 ); MCM, KS = 0.043 (𝑝= 0. 848 ); 𝛥𝜌), KS = 0.038 (𝑝= 0. 933 ). The
supercritical hard-gate results are: 𝑃*, KS = 0.033 (𝑝= 0. 900 ); 𝑇*, KS = 0.046 (𝑝= 0. 557 );
MCM, KS = 0.025 (𝑝= 0. 991 ); 𝛥𝜌), KS = 0.040 (𝑝= 0. 729 ). All advisory features also pass
at 𝑝= 1. 0 in both regimes, reflecting the near-identical zero-inflation structure of these
sparse binary features. No re-stratification was required.

The KS test results confirm that the stratified split has produced training and test sets that
are statistically indistinguishable with respect to the primary thermodynamic and chemical
drivers of IFT. Consequently, any performance gap observed between test-set accuracy and
EV accuracy cannot be attributed to within-regime sampling imbalance and must instead
be attributed to the distributional shift associated with the between-laboratory holdout,
which is the phenomenon under investigation in this paper.

**4. Model Development and Training Protocol**

Three machine learning architectures are trained independently for each thermodynamic
regime, yielding six candidate models: an artificial neural network (ANN), multivariate
adaptive regression splines (MARS), and a group method of data handling (GMDH)
polynomial network. All architectures receive the identical 10-feature input set ( **Table 6** ),
use the same regime-specific Min–Max scalers fitted on training data only, and are evaluated
on the same training–test partition. The external validation (EV) set is withheld throughout
all training, architecture search, and hyperparameter selection operations. A gradient
boosting regressor (GBR) noise ceiling is computed before any model training to establish a
data-limited upper bound on attainable accuracy for each regime.

4.1 Performance Benchmark (Noise Ceiling)

A GBR noise ceiling is computed on each regime's training set prior to model development
to establish whether a given model's test-set accuracy approaches the limit imposed by the
data itself, rather than by architectural choice. The rationale for using GBR as the ceiling
estimator is that it provides a well-controlled, single-algorithm non-parametric reference
without inflating the target through a multi-algorithm search that could overfit the ceiling to
the test set. The ceiling procedure computes the GBR test-set nRMSE and adds a 0.5
percentage-point allowance for finite-sample overfitting of the ceiling estimator. The 0.5pp
value corresponds to approximately one standard deviation of the GBR test nRMSE
estimated by five-fold cross-validation on the training pool (σ_CV(nRMSE) ≈ 0.4–0.5pp in


both regimes), and was selected to ensure that the threshold is exceeded only by models
that achieve genuine improvement on the noise floor rather than by random sampling
variation. This yields the following benchmark thresholds:

```
𝑛𝑅𝑀𝑆𝐸./0< 4 .31%𝑛𝑅𝑀𝑆𝐸./1<5%
```
The raw GBR nRMSE values from which these thresholds are derived are 3.81% for the
subcritical regime and 4.50% for the supercritical regime, achieved on test sets of 𝑛=
247 and 𝑛= 356 observations respectively. For reference, a random forest (RF) on the same
test sets achieves nRMSE of 4.45% (subcritical) and 5.93% (supercritical), confirming that
the GBR ceiling is the strictest defensible non-parametric benchmark.

The normalised root mean squared error (nRMSE) is defined as:

## 𝑛𝑅𝑀𝑆𝐸=

## 1

## 𝑦 ˉ

## R

## 1

## 𝑛

## .

```
2
```
```
% 3 "
```
## (𝑦%−𝑦S%))×100%

where 𝑦 _ˉ_ is the mean IFT of the evaluation set in mN m⁻¹, 𝑦% are the observed IFT values,
and 𝑦S% are the model predictions. Normalisation by the regime mean IFT renders nRMSE
comparable across regimes despite their different IFT ranges (subcritical mean
approximately 47 mN m⁻¹; supercritical mean approximately 38 mN m⁻¹): an nRMSE of 5%
corresponds to approximately 2.4 mN m⁻¹ absolute error in the subcritical regime and
approximately 1.9 mN m⁻¹ in the supercritical regime.

These thresholds are used as reference points for interpreting model accuracy; they do not
gate production model selection, which is governed by EV nRMSE (Section 4.5).

4.2 Artificial Neural Network

A fully connected multi-layer perceptron (MLP) is trained using the L-BFGS quasi-Newton
solver with L₂ weight regularisation (weight decay parameter α). Architecture selection
proceeds by grid search over hidden-layer configurations spanning one to four hidden layers
of widths drawn from {10, 15, 16, 20, 25, 32} and activation functions ReLU and tanh. The
selection criterion is a stability-penalised cross-validation score defined as:

```
𝑆=𝜀 ˉ +'+ 1. 5 𝜎 4 ,+'
```
where 𝜀 _ˉ_ +' is the mean CV RMSE across five folds and 𝜎 4 ,+' is its standard deviation. This
criterion penalises architectures whose performance is sensitive to random weight
initialisation, favouring networks that are robust across seeds. For each candidate
architecture, five random seeds are evaluated and the most stable seed is retained.

Training employs the L-BFGS quasi-Newton solver (full-batch; no explicit learning rate or
mini-batch size), which outperformed Adam on this tabular dataset size (~1 000–1 350


```
training observations) by leveraging curvature information to avoid suboptimal local
minima. The architecture search runs for a maximum of 2 000 L-BFGS iterations per
candidate (tolerance 10⁻⁶); the final model is retrained to a maximum of 50 000 iterations
(tolerance 10⁻⁷). No epoch-patience early stopping is applied; convergence is declared
when the loss improvement falls below the tolerance threshold. Weights are initialised with
Glorot uniform for ReLU and Glorot normal for tanh networks across 15 random seeds, with
the best seed selected by mean 5-fold CV RMSE. Inputs are normalised to [−1, 1] using
regime-specific Min–Max scalers fitted on training-pool observations only (Section 3.4).
```
```
Table 8 summarises the winning architectures and their full hyperparameter configurations.
The winning architecture for the subcritical regime is a three-hidden-layer network of width
(20, 15, 10) with ReLU activations and 𝛼= 0. 001 , achieving a mean stability score of 2.683
mN m⁻¹. The supercritical winner is a two-hidden-layer network of width (32, 16) with tanh
activations and 𝛼= 0. 001 , achieving a mean stability score of 2.171 mN m⁻¹.
```
```
Table 8. Model architectures and selected hyperparameters for both regimes.
```
**Regime Model Architecture / Configuration Key hyperparameters**

Sub ANN 3 layers: (20, 15, 10), ReLU (^) 𝛼= 0. 001 , L-BFGS, seed = 7
Sub MARS 16 terms, 5 active features (^) 𝑛𝑘= 20 , GCV penalty = 3
Sub GMDH 5 - layer polynomial network 5 seeds, best seed = 3
Sup ANN 2 layers: (32, 16), tanh 𝛼= 0. 001 , L-BFGS, seed = 3
Sup MARS 35 terms, all 10 features 𝑛𝑘= 75 , GCV penalty = 2
Sup GMDH 5 - layer polynomial network 5 seeds, best seed = 3
The structural extrapolation properties of the winning activation functions are directly
relevant to the EV results reported in Section 5. The subcritical ANN utilizes ReLU
activations, which are piecewise linear and unbounded: the function max(0, z) grows
without bound as its argument increases. A network layer that has learned a steeply positive
relationship between a latent representation and the output in one region of feature space
will continue that response linearly on inputs displaced in the same direction. By contrast,
the supercritical ANN utilizes tanh activations, which saturate at ±1. This provides
asymptotic boundedness in the activation output; the composed network output is a
trainable affine combination of these saturated final-layer activations, causing the network
predictions to eventually plateau outside the training domain. These distinct extrapolation
behaviours, unbounded linear divergence for the subcritical ReLU network and asymptotic
plateauing for the supercritical tanh network are consequential when the models are
applied to out-of-distribution EV data or extreme physical conditions, a phenomenon that is
evaluated in Sections 5 and 7. This property is consequential when the model is applied to
EV data from laboratories whose input distributions differ systematically from the training
pool, a phenomenon that is evaluated in Section 5.


4.3 Multivariate Adaptive Regression Splines

MARS (Friedman, 1991) constructs a piecewise linear regression model from hinge basis
functions of the form:

```
ℎ^5 (𝑥,𝑘)=𝑚𝑎𝑥 ( 0 , 𝑥−𝑘)ℎ^6 (𝑥,𝑘)=𝑚𝑎𝑥 ( 0 , 𝑘−𝑥)
```
where 𝑘 is a knot value located at a training observation. A forward pass greedily adds hinge
pairs to minimise the residual sum of squares; a backward pass prunes terms using the
generalised cross-validation (GCV) criterion:

## 𝐺𝐶𝑉(𝑀)=

## 1

## 𝑛

## 𝑅𝑆𝑆(𝑀)

```
_ 1 −𝑑a(𝑀)/𝑛b
```
## )^

where 𝑀 is the number of basis terms, RSS is the residual sum of squares, and 𝑑a(𝑀) is an
effective parameter count that is penalised relative to the true model degrees of freedom by
a GCV penalty parameter. The GCV criterion balances training fit against model complexity,
with higher penalty values producing sparser, more parsimonious models.

Hyperparameter selection employs five-fold cross-validation over a grid of maximum
number of terms (𝑛𝑘) and GCV penalty values. The subcritical production model
selects 𝑛𝑘= 20 and penalty = 3, yielding a final model with 16 terms using five active
features (𝑃*, 𝑇*, 𝛥𝜌), 𝑥+,", CH4_bin); MCM, BCM, BCM_bin, 𝑥-!, and N2_bin contribute zero
coefficients and are effectively inactive in the subcritical fit, suggesting that monovalent-
salinity and nitrogen effects are absorbed by the thermodynamic features in this regime. The
supercritical production model selects Mmax = 75 and penalty = 2, yielding a final model with
35 terms that engages seven of the ten candidate features (the three binary indicator flags
BCMbin, CH4bin, and N2bin are pruned during the backward GCV selection).

The critical structural property of MARS for cross-laboratory generalisation is its linear
extrapolation behaviour. Outside the training convex hull, each hinge function h_+(x, k)
evaluates as (x − k) and grows linearly with slope +1; each h_-(x, k) below its knot evaluates
to zero. The overall MARS model is therefore a piecewise-linear sum of at most second-order
pairwise hinge products, and extrapolated predictions grow at most linearly in the
magnitude of the distributional shift. This is in qualitative contrast to GMDH polynomial
networks (where the effective polynomial degree compounds across layers, producing
super-linear divergence - Section 4.4) and to deep ANN architectures (where, although the
asymptotic growth in any one direction is also linear, the composition of nonlinear
activations can produce arbitrarily curved high-dimensional response surfaces that
extrapolate non-physically on inputs displaced jointly across multiple features - Section
4.2). The overall model therefore continues linearly at the local gradient of the nearest
training boundary rather than accelerating nonlinearly as input values move away from the
training distribution. This characteristic fundamentally limits the growth of prediction errors
on out-of-distribution inputs: where an ANN may exhibit quadratic or exponential error
growth as inputs depart from the training hull, MARS prediction error grows at most linearly


with the magnitude of the distributional shift. This property underpins the expectation,
confirmed in Section 5, that MARS generalises more reliably to between-laboratory EV data
than ANN or GMDH.

4.4 Group Method of Data Handling

GMDH (Ivakhnenko, 19 68 ) builds a self-organising polynomial network in which each
computational neuron accepts two inputs (𝑣) and fits a second-degree polynomial:

```
𝑦S=𝑎 7 +𝑎"𝑢+𝑎)𝑣+𝑎 8 𝑢)+𝑎$𝑢𝑣+𝑎 9 𝑣)
```
with coefficients selected by an external criterion, here five-fold cross-validation MSE,
applied to a held-out validation portion of the training data. Layers are added sequentially;
within each layer, all pairwise combinations of the previous layer's outputs are evaluated as
candidate neuron inputs, and only neurons that reduce the external criterion are retained.
This self-organising procedure means that the network topology is determined entirely by
the data rather than by a pre-specified architecture.

Five random seeds are evaluated for each regime to mitigate sensitivity to the stochastic
initialisation of the layer-by-layer neuron selection; the seed yielding the lowest CV RMSE on
the final layer is retained. The subcritical GMDH network converges to five layers with
monotonically decreasing layer-by-layer validation MSE, falling from 18.19 mN² m⁻² at layer
1 to 8.66 mN² m⁻² at layer 5. The supercritical network also converges to five layers,
confirming that both regimes support the same network depth under the external criterion.

The polynomial basis of GMDH introduces a structural extrapolation risk analogous to
Runge's phenomenon. Across five network layers in which each neuron evaluates a degree-
2 polynomial of two layer-(L−1) outputs, the maximum effective polynomial degree of the
layer-5 output is 2⁵ = 32; the actual degree of any production-path polynomial is bounded
above by 32 but is typically lower because the layer-wise external-criterion selection retains
only neurons that improve cross-validation MSE, dropping many candidate polynomial
products. Even at degrees substantially below 32, high-degree polynomial functions grow
without bound on inputs outside the fitting range, and the rate of growth is superlinear in the
magnitude of the extrapolation displacement. For multi-layer GMDH networks this risk
amplifies with depth: errors at an intermediate layer become inputs to the next layer's
polynomial neurons, compounding the algebraic divergence. This structural property makes
GMDH susceptible to catastrophic error inflation on EV data from laboratories whose input
distributions differ from the training pool, a prediction that is evaluated quantitatively in
Section 5.

4.5 Model Selection Criterion

The production model for each regime is selected by EV nRMSE, not test-set nRMSE. This
decision is the central methodological departure of the present study, motivated by the


```
observation that 24 of 29 prior studies rely on random-split test sets that do not measure
cross-laboratory generalisation (Section 1). As established in Section 2.1, within-
distribution test performance is an insufficient criterion for deployment because it conflates
predictive accuracy with the memorisation of apparatus-level biases. EV nRMSE provides a
rigorous, directly relevant performance metric for the field-scale GCS applications where
models must generalise to unseen measurement sources. The production model for both
regimes is MARS, selected on the basis of EV nRMSE as described in Section 5.
```
**5. Results**

```
5.1 Cross-Validation Performance
```
```
Five-fold cross-validation establishes the training stability of each model before external
evaluation is conducted. The CV procedure searches the hyperparameter space and selects
the configuration that minimises the penalised criterion (mean CV RMSE + 1.5 × SD CV
RMSE), where the penalty discourages configurations that achieve low mean error at the
cost of high fold-to-fold variability. Table 9 reports the CV RMSE mean and standard
deviation of the selected configuration for each of the six candidate models, together with a
stability score that reflects this penalised criterion. For the GMDH, which uses an internal
80:20 hold-out rather than k-fold partitioning, the reported statistics are the mean and
standard deviation of the best-seed validation RMSE across five random seeds.
```
```
Table 9. Five-fold cross-validation performance for all six candidate models.
```
**Regime Model CV RMSE mean (mN m** ⁻ **¹) CV RMSE SD (mN m** ⁻ **¹) Stability score**

Subcritical ANN 2.624 0.039 2.683

Subcritical MARS 3.237 0.138 3.444

Subcritical GMDH 3.309 0.231 3.656

Supercritical ANN 2.049 0.082 2.171

Supercritical MARS 2.116 0.081 2.238

Supercritical GMDH 3.617 0.143 3.831

```
Subcritical GMDH seeds: val RMSE values of 2.968, 3.206, 3.340, 3.463, 3.554 mN m ⁻ ¹ across seeds 3, 4,
2, 0, 1. Supercritical GMDH seeds: 3.453, 3.510, 3.637, 3.740, 3.741 mN m ⁻ ¹.
```
```
The consistent ordering ANN > MARS > GMDH on CV RMSE mirrors the test-set ranking,
confirming that the test-set results reported in Section 5.2 are not artifacts of a single train-
test partition. The supercritical ANN achieves the lowest stability score across all six models
(2.171 mN m⁻¹), reflecting both its low mean CV error and its unusually low fold-to-fold
variance, a pattern that, as shown in Section 5.3, reflects memorisation of training
distribution structure rather than genuine generalisation.
```

```
5.2 Test-Set Performance
```
```
The held-out test set consists of observations from the same laboratories as the training
data but withheld throughout all phases of model development; it represents the model's
performance on unseen data from known measurement sources. Table 10 reports the full
cross-model performance comparison for both thermodynamic regimes, including test-set
metrics, external validation (EV) metrics, and the test-to-EV nRMSE ratio, which quantifies
the degree of performance degradation when the model is applied to measurements from
held-out laboratories. The production model for each regime, identified by the lowest EV
nRMSE, is marked with the * symbol. The EV set is fully locked and was not used at any point
during model development or hyperparameter selection.
```
```
Table 10. Cross-model performance summary.
```
**Regime Model**

```
Test
nRMSE
(%)
```
```
Test
RMSE
(mN
m ⁻ ¹)
```
```
Test
MAE
(mN
m ⁻ ¹)
```
```
Test
AAPE
(%)
```
```
Test
R²
```
```
EV
nRMSE
(%)
```
```
EV
RMSE
(mN
m ⁻ ¹)
```
```
EV MAE
(mN m ⁻ ¹)
```
```
EV R²
```
```
Test-
to-EV
ratio
```
Sub ANN 4.57 2.156 1.424 3.19 0.964 32.00 15.018 9.661 −0.483 7.0

Sub MARS* 5.46 2.572 1.567 3.36 0.949 17.00 7.981 5.126 0.581 3.1

Sub GMDH 6.21 2.929 1.914 4.37 0.934 31,999 15,018 2,443 −1,483,183 5,152

Sup ANN 3.77 1.438 0.945 2.68 0.967 17.82 5.526 4.357 0.450 4.7

Sup MARS* 5.60 2.134 1.446 3.90 0.928 5.62 1.744 1.458 0.945 1.0

Sup GMDH 9.25 3.523 2.591 6.95 0.805 23.59 7.315 3.772 0.036 2.6

```
Noise ceilings: subcritical GBR nRMSE = 4.31%; supercritical GBR nRMSE = 5.00 GMDH subcritical EV
predictions exhibit numerical divergence at 18 of 188 observations (predicted absolute values exceeding
1,000 mN/m; maximum 141,615 mN/m). Two GMDH metrics are reported. The unclipped headline value
(EV nRMSE = 31,999%) is the deployment-relevant number: it is what a practitioner who applied the
trained GMDH model to these inputs without safeguards would observe. The trimmed value, obtained by
removing the 18 divergent predictions and recomputing on the remaining 170 (EV nRMSE = 245.28%), is
reported for fair architectural comparison and confirms that GMDH performs poorly even in the absence
of polynomial divergence. The contrast between the trimmed and unclipped figures is the substantive
evidence of the catastrophic-failure mode predicted by the 2⁵ = 32 effective polynomial degree (Section
4.4).
```
```
Under conventional test-set evaluation, the ANN achieves the lowest nRMSE in both
regimes: 4.57% subcritically and 3.77% supercritically, placing it within or near the noise
ceiling for both cases. MARS is intermediate in both regimes (5.46% and 5.60%), and GMDH
is the weakest (6.21% and 9.25%). The ranking ANN > MARS > GMDH is consistent across
both thermodynamic regimes and across all reported test-set metrics. By conventional test-
set criteria alone, the ANN would be selected as the production model in both cases. The EV
columns of Table 10 , however, reveal a qualitatively different picture: the ANN, despite its
```

superior test-set performance, is the worst-performing model on external validation in both
regimes, and the GMDH exhibits catastrophic divergence in the subcritical case.

_5.3 External Validation Reversal_

The EV results in **Table 10** constitute the central finding of this study: the model that
generalises best across laboratory boundaries is consistently not the model that performs
best on the test set, and the ranking reversal is not marginal but spans multiple orders of
magnitude. This finding is reproducible across both thermodynamic regimes and is not
attributable to small EV sample sizes or single-partition sampling variability. The test-to-EV
nRMSE ratio column in **Table 10** quantifies this degradation: subcritical ratios of 7.0 (ANN),
3.1 (MARS), and 5,152 (GMDH); supercritical ratios of 4.7 (ANN), 1.0 (MARS), and 2.6
(GMDH).

In the subcritical regime, the ANN achieves EV nRMSE = 32.00% and EV R² = −0.483. An R²
below zero indicates that the model performs worse than the trivial baseline of predicting
the dataset mean for every observation; the ANN has learned a response surface that is
optimised for the within-training-distribution input manifold and extrapolates non-
physically when confronted with the input configurations occupied by the Li et al. (2012) and
Aggelopoulos et al. (2010) laboratories. The subcritical GMDH exhibits catastrophic
numerical divergence: EV nRMSE = 31,999% and EV R² = −1,483,183, consistent with the
algebraic amplification of out-of-distribution inputs propagated through five polynomial
network layers, where the composition of degree-2 polynomials across layers yields an
effective polynomial degree of 2^5 = 32, causing rapid divergence from the training manifold,
producing unbounded output. The subcritical MARS, by contrast, achieves EV nRMSE =
17.00% and EV R² = 0.581. Its piecewise linear structure constrains predictions to a linear
continuation of the nearest training region, preventing the runaway extrapolation that afflicts
the ANN and GMDH architectures.

In the supercritical regime, the reversal is equally pronounced but the absolute performance
levels differ markedly from the subcritical case. The supercritical ANN achieves EV nRMSE
= 17.82% against a test nRMSE of 3.77%, a 4.7-fold degradation that confirms the
interpolation-to-generalisation performance gap. The supercritical GMDH exhibits
moderate rather than catastrophic degradation (EV nRMSE = 23.59%, EV R² = 0.036),
suggesting that the supercritical EV inputs are less extreme relative to the training manifold
than the subcritical EV inputs. The supercritical MARS achieves EV nRMSE = 5.62%,
indistinguishable from its test nRMSE of 5.60%, and EV R² = 0.945, representing the only
instance in this study of a model achieving equivalent performance on test and EV data.

**Figure 4** presents parity plots for all three models on the subcritical EV set, providing a visual
representation of the performance differences quantified in **Table 10**.


```
Figure 4. Subcritical external validation parity plots: observed vs. predicted IFT (mN m⁻¹)
```
The parity plots confirm visually what the metrics establish quantitatively: the ANN
predictions in panel (a) are clustered away from the 1:1 line with no coherent structure,
while the MARS predictions in panel (b) exhibit a consistent upward displacement that is
concentrated in a single laboratory's data rather than distributed uniformly across the EV
set. The structured nature of the MARS offset, visible in panel (b), is diagnostic of a
laboratory-level effect rather than a model failure, as discussed in Section 5.4.

**Figure 5** presents the equivalent parity plots for the supercritical EV set.

```
Figure 5. Supercritical external validation parity plots
```
The supercritical parity plots reveal that the MARS model maintains tight adherence to the
1:1 reference line across both EV laboratories and across the full range of observed IFT
values from approximately 12 to 45 mN m⁻¹, confirming that the supercritical training corpus
provides adequate coverage for genuine cross-laboratory generalisation. The ANN panel
demonstrates that higher test-set accuracy does not translate to better cross-laboratory
performance: predictions that closely track the training distribution diverge substantially
when the laboratory context changes.


```
5.4 Per-Laboratory Diagnosis: Subcritical EV Gap
```
```
The subcritical MARS model exhibits a 3.1-fold degradation from test to EV nRMSE (5.46%
to 17.00%), raising the question of whether this gap is attributable to a chemistry-based
limitation, specifically the absence of an anionic composition metric (ACM) feature capable
of representing Na₂SO₄ brine chemistry, or to a systematic apparatus-level offset at the Li et
al. (2012) laboratory. Distinguishing these hypotheses has operational significance: a
chemistry explanation implies a tractable feature engineering remedy, whereas an
apparatus explanation implies that the offset is a property of the measurement source and
will persist regardless of model architecture. Table 11 reports EV performance
disaggregated by laboratory, including the Uncertainty Inflation Factor (UIF), defined as the
ratio of the laboratory EV nRMSE to the overall MARS test nRMSE.
```
```
Table 11. Per-laboratory EV performance and Uncertainty Inflation Factor (UIF).
```
**Regime Laboratory n EV nRMSE (%) (mN mEV MAE** ⁻ **¹)**^ **Bias (%) EV R² UIF Flag**

Sub Li et al. (2012) 134 18.61 - +11.09 0.464 3.41 HIGH

Sub Aggelopoulosal. (2010) et 54 7.12 - +1.23 0.859 1.30 -

Sup Aggelopoulos et al. (2011) 48 5.25 - +1.23 0.871 0.94 -

Sup Pereira et al.
(2016)

```
44 6.14 - −3.22 0.932 1.10 -
```
```
UIF > 2 indicates substantially worse generalisation than training interpolation, flagging likely laboratory-
level offset. UIF values near unity indicate that the model generalises to that laboratory without
degradation.
```
```
The UIF of 3.41 for Li et al. (2012) indicates that the subcritical MARS model is 3.4 times less
accurate on this laboratory's data than on the test set from the training distribution, while
the Aggelopoulos et al. (2010) UIF of 1.30 is near unity and consistent with the known brine
chemistry overlap between that laboratory and the training corpus. To discriminate between
chemistry and apparatus explanations, the 188 subcritical EV observations are
decomposed into the six Na₂SO₄-brine rows from Li et al. (2012), representing the chemistry
not captured by the training feature set, and the remaining 182 observations. The six Na₂SO₄
rows achieve nRMSE = 7.29% (n = 6). Although the subsample is too small for a reliable
bootstrap confidence interval, the 2.5-fold difference between this value and the Li et al.
(2012) aggregate nRMSE of 18.61% (n = 134) is large relative to any plausible estimation
uncertainty at n = 6, and the direction of the contrast is unambiguous: the Na₂SO₄
observations perform substantially better than the full Li et al. (2012) aggregate despite
representing the chemical type absent from training. The inference is accordingly stated as
consistent with, rather than conclusive of, chemistry-independence; the primary evidence
```

remains the 128 NaCl and KCl observations from the same apparatus, which exhibit the
same systematic +11.09% over-prediction bias despite their chemical class being well
represented in training. The stronger evidence comes from the 128 NaCl and KCl rows from
Li et al. (2012) exhibiting the same +11.09% bias direction.

**Figure 6** presents residual distributions by laboratory, confirming the systematic positive
bias at Li et al. (2012) and the near-zero bias at Aggelopoulos et al. (2010).

```
Figure 6. Subcritical EV residual distributions by laboratory.
```
The violin plot confirms that the residual distribution at Li et al. (2012) is not merely wider
than at Aggelopoulos et al. (2010) but is also displaced upward in its entirety, with the
median residual substantially exceeding the 80% prediction interval half-width of ±2.44 mN
m⁻¹. This displacement, rather than the spread, is the primary driver of the elevated UIF,
supporting the apparatus-level interpretation over a model error interpretation.

_5.5 Supercritical Generalisation_

The supercritical MARS model constitutes the strongest result of this study and the only
architecture in the comparison to achieve test-set and cross-laboratory EV performance
that are statistically indistinguishable at the reported precision. The model achieves EV R² =
0.945 and EV nRMSE = 5.62% against both Aggelopoulos et al. (2011) and Pereira et al.
(2016), compared to a test nRMSE of 5.60%, a difference of 0.02 percentage points, well
within round-off precision. To support this claim formally, a 10,000-iteration percentile
bootstrap CI was computed by resampling the 92 EV residuals with replacement; the
resulting 95% CI for EV nRMSE is [ 5 %, 6.22%], which contains the test nRMSE of 5.60%,


confirming that the difference is within sampling variability at the EV sample size. Both
supercritical EV UIFs are near unity: Aggelopoulos et al. (2011) achieves UIF = 0.94,
indicating that the model is marginally more accurate on this laboratory's data than on the
test set, while Pereira et al. (2016) achieves UIF = 1.10, a 10% degradation that is statistically
indistinguishable from unity at any conventional threshold. This outcome stands in contrast
to the ANN's 4.7-fold degradation from test to EV nRMSE and the GMDH's EV R² of 0.036,
confirming that the supercritical generalisation is attributable to the MARS architecture and
not to particularly favourable EV conditions. The supercritical success is attributed in part
to the denser and more uniform pressure-temperature coverage provided by Liu et al. (2017)
in the supercritical training pool, which reduces the interpolation distance from any EV input
to the nearest training observation; it is further evidence that the BCM and Δρ² feature pair
adequately represents the divalent salting-out effect at supercritical pressures, enabling
the model to generalise to the mixed NaCl/CaCl₂ measurements of Aggelopoulos et al.
(2011) without chemistry-specific retraining. Stronger evidence will require an independent
CaCl₂-exclusive supercritical EV laboratory, which is not currently available in the published
literature.

```
Figure 7. Supercritical EV residual distributions by laboratory.
```
Both supercritical residual distributions in **Figure 7** are centred near zero and exhibit no
skewness, indicating that the model is as likely to over-predict as to under-predict across
the full supercritical EV range, a hallmark of genuine generalisation rather than partial
compensation. The symmetry of both distributions, combined with the near-unity UIFs and
the test-to-EV nRMSE ratio of 1.0, collectively constitute the strongest available evidence
that the supercritical MARS model has learned a physically representative response surface
rather than a training-distribution-specific interpolant.


_5.6 Uncertainty Quantification_

Prediction intervals are constructed using split conformal prediction (Vovk 2005;
Angelopoulos & Bates 2023). The procedure uses the held-out test set as a calibration set
(subcritical n = 247; supercritical n = 356) to compute the distribution of absolute residuals,
termed nonconformity scores, defined as r_i = |y_i − ŷ_i|. The conformal quantile at nominal
level 1 − α is:

```
𝑞S" 6 :=𝑄𝑢𝑎𝑛𝑡𝑖𝑙𝑒 j{𝑟%}%^23 ",
```
## ⌈(𝑛+ 1 )( 1 −𝛼)⌉

## 𝑛

```
p
```
This estimator provides a finite-sample marginal coverage guarantee: for any new
observation drawn exchangeably from the same distribution as the calibration set, the
prediction interval [ŷ − q̂ , ŷ + q̂ ] contains the true value with probability at least 1 − α. When
the EV observations are not exchangeable with the calibration set, that is, when the EV
laboratories are drawn from a different distribution, the empirical coverage on the EV set will
systematically underperform the nominal level, providing a formal statistical test of
distributional non-exchangeability. **Table 12** reports calibrated half-widths and the EV
coverage achieved at each nominal level.

```
Table 12. Conformal prediction interval half-widths (mN m⁻¹) calibrated on the held-out
test set, and EV set coverage achieved at each nominal level
```
```
Regime 80% PI^
(mN m ⁻ ¹)
```
```
90% PI
(mN m ⁻ ¹)
```
```
95% PI
(mN m ⁻ ¹)
```
```
EV cov.
at 80%
```
```
EV cov.
at 90%
```
```
EV cov.
at 95%
Subcritical ±2.44 ±3.35 ±4.87 45.7% 59.6% 68.6%
Supercritica
l ±2.25^ ±3.76^ ±5.07^ 75.0%^ 98.9%^ 100.0%^
```
_Target coverages are 80%, 90%, and 95% respectively. Values substantially below target indicate
distributional non-exchangeability between EV and calibration sets._

The subcritical coverage gap constitutes formal statistical evidence of distributional non-
exchangeability: achieving only 45.7% coverage at the 80% nominal level, in a sample of n =
188, is not attributable to finite-sample variability in the conformal quantile estimator: the
gap of 34.3 percentage points identifies the Li et al. (2012) laboratory as drawn from a
distribution that is statistically distinct from the training corpus. Per-laboratory
decomposition of subcritical EV coverage confirms this interpretation: Li et al. (2012)
achieves 80%-PI coverage of 40.3% (target: 80%), while Aggelopoulos et al. (2010) achieves
59.3%, substantially better but still below the nominal level, consistent with its UIF of 1.30.
The supercritical results display a different pattern: 80%-PI coverage of 75.0%, which is 5
percentage points below nominal, is within the expected downward bias of the finite-sample
conformal quantile estimator when the nonconformity score distribution has a heavy upper
tail, while the 90% and 95% levels achieve 98.9% and 100.0% coverage respectively,
indicating conservative calibration at higher nominal levels. Both supercritical EV


laboratories, Aggelopoulos et al. (2011) at 72.9% and Pereira et al. (2016) at 77.3%, achieve
similar 80%-PI coverage, consistent with their near-unity UIFs.

**Figure 8** and **9** presents the conformal prediction envelopes for both regimes.

```
Figure 8. Conformal prediction envelopes for subcritical MARS model
```
```
Figure 9 Conformal prediction envelopes for supercritical MARS model
```

The subcritical envelope illustrates that the test-calibrated prediction bands are too narrow
to contain the Li et al. (2012) observations, whose systematic offset places them
consistently above the upper prediction bound. While the supercritical envelope
demonstrates that the supercritical calibration bands are appropriately sized for the EV
distribution, with the vast majority of EV observations falling within the 80% band, an
outcome that is only achievable when the EV and calibration distributions are
exchangeable.

_5.7. Regime Performance Asymmetry_

The 3-fold difference in EV performance between the subcritical (EV nRMSE = 17.00%) and
supercritical (EV nRMSE = 5.62%) MARS models reflects fundamental differences in the data
landscape of the two regimes rather than modelling deficiencies in the subcritical equation
itself.

The subcritical regime covers a wider IFT range (approximately 15–79 mN m⁻¹) than the
supercritical regime (approximately 14–40 mN m⁻¹), requiring the model to represent larger
absolute variation in IFT across the input feature space. More critically, the training coverage
of the subcritical regime is sparse in key chemical regions: divalent-cation brines, mixed-
anion systems, and high-temperature low-density-contrast combinations are
underrepresented relative to the prevalence of NaCl-dominated systems. The EV
laboratories were selected precisely because they provide coverage of these
underrepresented regions: Aggelopoulos et al. (2010) contributes CaCl₂-brine
measurements and Li et al. (2012) provides KCl and multi-cation brine observations,
meaning the subcritical EV set is inherently more challenging than a random sample from
the subcritical pool and should be expected to yield higher nRMSE than test-set
performance alone would predict.

The supercritical regime benefits from the dense and systematic coverage provided by Liu
et al. (2017) (38.4% of the total dataset; Section 3.1), spanning a wide P–T grid at NaCl
concentrations from pure water to approximately 5 mol kg⁻¹. This coverage substantially
reduces the interpolation distance from any supercritical EV input to the nearest training
observation, and it is this proximity, not a structural advantage of the supercritical equation
itself, that explains the excellent EV generalisation. Notably, the supercritical MARS model
generalises to the Aggelopoulos et al. (2011) CaCl₂ measurements despite the training pool
being predominantly NaCl-dominated at supercritical conditions. This suggests that BCM
and Δρ² together adequately capture the divalent salting-out effect at supercritical
pressures, without requiring explicit CaCl₂-brine observations in the supercritical training
pool.

From a CCS application perspective, the regime asymmetry has direct practical
significance. Supercritical conditions, typical of CO₂ injection at depths greater than
approximately 800 m into warm saline aquifers, can be predicted with high confidence using
the production MARS equation (EV R² = 0.945, UIF approximately 1.0 for both supercritical


EV laboratories). Subcritical conditions, relevant to shallower formations, cooler high-
latitude aquifers, and near-wellbore regions during pressure transients, carry higher model
uncertainty and require UIF-adjusted prediction intervals when the measurement source is
not well represented in the training dataset.

_5.8 Physical Consistency_

Physical consistency validation confirms that the production MARS models reproduce
qualitatively correct IFT behaviour along all three principal input dimensions: pressure,
temperature, and gas-phase impurity composition. A model that achieves low RMSE but
violates expected physical trends along any of these axes would be unreliable for
deployment in conditions not directly represented in the training data. The subsections
below examine each dimension in turn.

(i) Pressure–IFT Response: IFT in CO₂-brine systems is physically expected to decrease
monotonically with increasing reduced pressure at fixed temperature and composition, a
consequence of the increasing density and solvating power of CO₂ with pressure and the
corresponding reduction of the CO₂-brine density difference - Macleod-Sugden
relationship. **Figure 10** and **11** confirms that IFT decreases monotonically with Pr, consistent
with the expected compression of the CO₂–brine density contrast with increasing pressure.

```
Figure 10. (subcritical). MARS predicted IFT as a function of reduced pressure (Pr) across
the subcritical training range, at representative brine and temperature conditions
```

```
Figure 11. (supercritical). MARS predicted IFT as a function of reduced pressure (Pr) across
the supercritical training range.
```
Both MARS models pass the physical checks for pressure confirming that the piecewise
linear structure of MARS does not generate unphysical IFT-pressure relationships within the
training domain.

(ii) Temperature–IFT Response: **Figure 12** (subcritical) and **Figure 13** (supercritical) present
MARS model predictions along the temperature axis, sweeping Tr from its training minimum
to maximum at fixed median values of all other features (pure CO₂, MCM = median, BCM =
0, Δρ² co-varied with Pr via OLS).

```
Figure 12. (subcritical). MARS predicted IFT as a function of reduced temperature (Tr)
across the subcritical training range, at representative brine and temperature conditions
```
```
Figure 13. (supercritical). MARS predicted IFT as a function of reduced temperature (Tr)
across the supercritical training range.
```
The established physical expectation is that IFT decreases with increasing temperature at
constant pressure, a consequence of thermal expansion reducing CO₂–brine density
contrast Δρ and thus reducing IFT through the Macleod–Sugden relation. Both models
reproduce this qualitative trend: the subcritical response shows a clear decrease in
predicted IFT across the Tr range, and the supercritical response is more nearly linear,
consistent with the reduced sensitivity of supercritical CO₂ density to temperature at


constant pressure. Near Tr ≈ 1.0 (the CO₂ critical point), the Macleod–Sugden framework
predicts a local density anomaly; this inflection is captured qualitatively but is smoothed by
the piecewise-linear hinge structure at the training data resolution available. Note that in the
subcritical equation, MCM carries zero coefficient after pruning (Section 6.1); salinity enters
through Δρ², so the subcritical temperature sweep reflects the Δρ²–Tr coupling rather than
an independent temperature term; this is a physically consistent result, not a model
limitation.

(iii) Impurity–IFT Response (xCH₄, xN₂): **Figure 14** (subcritical) and **Figure 15** (supercritical)

present predicted IFT as a function of CO₂ impurity composition (CH₄ and N₂ mole fractions)

and divalent cation molality (BCM) at representative conditions, with all non-swept features

held at pure CO₂ and zero-concentration baselines (BCM = 0, MCM = median, Δρ² co-varied

with Pr via OLS).

```
Figure 14. (subcritical). MARS predicted IFT response to gas-phase impurity fractions (CH₄
mol%, N₂ mol%) at representative conditions.
```

```
Figure 1 5. (supercritical). MARS predicted IFT response to gas-phase impurity fractions
(CH₄ mol%, N₂ mol%) at representative conditions.
```
The established physical expectation for lighter gas-phase impurities (CH₄, N₂) is a positive

IFT response: these gases have lower densities than CO₂ at the same conditions, so their
presence in the gas phase reduces the effective gas-phase density, increases the CO₂–brine

density contrast Δρ, and thereby elevates IFT through the Macleod–Sugden relationship. The

supercritical MARS model reproduces the expected positive IFT response for both CH₄ and

N₂ (Figure 15), with the response being larger in absolute magnitude than in the subcritical
regime, consistent with the greater sensitivity of supercritical CO₂ density to gas-phase

composition near the critical point. The subcritical MARS model reproduces the positive

CH₄ response through the active CH4bin hinge term (Section 6.1). However, xN₂ and N2bin carry

zero coefficients in the subcritical equation, and the subcritical model therefore produces

a structurally flat N₂ response panel as **Figure 14(b)** correctly shows. This sparsity is

physically defensible: N₂-bearing subcritical observations are sparse in the training corpus,

and the MARS backward-pruning step identified no statistically significant N₂ contribution

at the subcritical coverage available. The zero-coefficient result is reported as a feature-

pruning outcome rather than a physical claim that N₂ has no subcritical effect; a future

dataset with denser subcritical N₂ coverage may yield a non-trivial coefficient.

For divalent cation molality (BCM), the expected physical behaviour is a stronger IFT

increase per unit molality than for monovalent cations (MCM), driven by the higher ion–

dipole interaction energy of divalent ions at the CO₂–water interface. The BCM panels in

**Figures 14** and **15** confirm this: the rate of IFT increase per mol kg⁻¹ BCM exceeds that per

mol kg⁻¹ MCM, consistent with the physical mechanism.

_5.9 Sensitivity Analysis_

Sensitivity analysis quantifies the relative importance of each input feature to the predicted
IFT, providing both a qualitative screen of feature activity and a quantitative attribution of
model response. For models containing multiplicative hinge interactions, such as the
production MARS equations, traditional one-at-a-time (OAT) perturbation across large
intervals (e.g., ±20% of range) can activate large interaction coefficients in isolation from
their joint activation context, producing magnitude estimates that are mathematical
artefacts rather than physically interpretable sensitivities. We therefore employ a dual
protocol: (i) OAT screening to identify active versus effectively inactive features, and (ii) local
linearisation at representative training conditions to quantify physically plausible feature
impacts.


**Figure 16 and 17** presents the sensitivity profiles for both regimes, expressed as the
estimated change in predicted IFT (∆IFTpred) for a 10% shift in each feature's normalised
range, calculated via local linearisation at the median training conditions.

```
Figure 16 : Subcritical sensitivity
```

```
Figure 17 : Supercritical sensitivity
```
In the subcritical regime ( **Figure 16** ), Tr (reduced temperature) and ∆𝜌) (squared density
difference) emerge as the primary drivers of model sensitivity. The dominance of Tr ( −26.7
mN/m per 10% shift) reflects the steep non-monotonic IFT gradient near the CO₂ critical
temperature which the subcritical regime straddles. ∆𝜌) ( +11.8 mN/m) encodes the primary
pressure dependence through the Macleod–Sugden relationship. Pr contributes a
secondary but non-zero response, while the remaining features: MCM, BCM, and gas
impurities, exhibit near-zero first-order sensitivity at median conditions, consistent with
their status as sparse or advisory features in this regime.

In the supercritical regime ( **Figure 17** ), the sensitivity profile is more distributed, reflecting
the activation of all ten features in the production equation. Tr remains the most sensitive
feature (+71.2 mN/m per 10% shift at median conditions), although we note that this high
local sensitivity is specific to the transition region near the critical point; at higher
supercritical temperatures, the response stabilises. Pr and ∆𝜌) carry comparable first-order
impacts (−24.7 and −22.9 mN/m, respectively), while gas-phase impurities (xN2, xCH4) and
monovalent salinity (MCM) produce modest but physically consistent IFT elevations.
Divalent cation molality (BCM) exhibits a non-zero but small first-order impact at median
conditions, though its higher-order interaction effects at high concentrations remain
significant.

The qualitative rank-order of feature importance - ∆𝜌) and Tr dominating subcritically, and
a richer multivariate response supercritically is consistent across local linearisation points.
These results confirm that the feature engineering decisions documented in Section 3


successfully provide the MARS models with the thermodynamic and compositional signals
required to capture the complex CO₂–brine IFT response surface.

**6. MARS Symbolic Equations**

The availability of an explicit, closed-form algebraic expression distinguishes MARS from
most other machine learning architectures employed in reservoir engineering and makes it
uniquely suited for direct deployment in geological carbon storage (GCS) workflows.
Reservoir simulation platforms such as Eclipse, CMG GEM, and TOUGH2 routinely require
IFT as a scalar input at each grid cell and time step; an equation that can be evaluated
without calling a Python runtime or loading a model file eliminates a substantial integration
barrier. Reproducibility across institutions is equally improved: any research group or
regulator can independently verify a prediction by arithmetic alone, without access to
proprietary training infrastructure. Friedman (1991) introduced Multivariate Adaptive
Regression Splines as a method that retains this algebraic transparency while achieving the
nonlinear accuracy of more opaque learners. The sections below present both the
subcritical and supercritical production equations in full, together with all scaler
parameters required to normalise input features to the [− 1 , 1 ] interval prior to evaluation.

6.1 Subcritical MARS Equation

The subcritical production model is a 16-term equation derived from five active features out
of the ten candidates considered during training: reduced pressure (𝑃*), reduced
temperature (𝑇*), squared density difference (𝛥𝜌)), methane mole fraction (𝑥+,"), and the
methane presence indicator (CH4_bin). The remaining five features, MCM, BCM,
BCMbin, 𝑥-!, and N2bin, carry zero coefficients, indicating that the MARS backward pruning
step found no statistically significant improvement in the generalised cross-validation
(GCV) criterion from including them explicitly. This sparsity is not a limitation but a physically
informative result: subcritical conditions are characterised by a narrower thermodynamic
variability, and the density-difference term subsumes much of the information that salinity
and impurity features would otherwise contribute.


## IFTSUB =^51.^6236

```
+ 17. 9632 max ( 0 , Δ𝜌.)− 0. 0282 )
+ 275. 259 max ( 0 , 0. 0282 −Δ𝜌.))
+ 26. 5844 max ( 0 , 𝑃*,.+ 0. 7198 )
+ 26. 138 max ( 0 , − 0. 7198 −𝑃*,.)
− 20. 2105 max ( 0 , 𝑇*,.+ 0. 3956 )
+ 12. 776 max ( 0 , − 0. 3956 −𝑇*,.)
− 51. 1174 max ( 0 , − 0. 7198 −𝑃*,.)⋅max ( 0 , 𝑇*,.+ 0. 518 )
+ 137. 846 max ( 0 , − 0. 7198 −𝑃*,.)⋅max ( 0 , − 0. 518 −𝑇*,.)
− 55. 2389 max ( 0 , 𝑃*,.+ 0. 7198 )⋅max ( 0 , Δ𝜌.)+ 0. 7039 )
− 97. 8475 max ( 0 , 𝑃*,.+ 0. 7198 )⋅max ( 0 , − 0. 7039 −Δ𝜌.))
+ 66. 6219 max ( 0 , 𝑇*,.+ 0. 516 )⋅max ( 0 , Δ𝜌.)− 0. 0282 )
+ 283. 624 max ( 0 , 0. 0282 −Δ𝜌.))⋅CH4_bin.
− 499. 802 max ( 0 , 𝑇*,.+ 0. 8978 )⋅max ( 0 , 0. 0282 −Δ𝜌.))
− 45. 0736 max ( 0 , − 0. 8978 −𝑇*,.)⋅max ( 0 , 0. 0282 −Δ𝜌.))
+ 38. 3241 max ( 0 , − 0. 3956 −𝑇*,.)⋅𝑥CH",.
```
Where all features carry the subscript 𝑠 to denote that they have been Min–Max scaled
to [− 1 , 1 ] using the transformation 𝑥.= 2 (𝑥−𝑥;%2)/(𝑥;<=−𝑥;%2)− 1 with the
parameters listed in Appendix A1. The output is IFT in mN/m.

The dominant structural driver of the subcritical equation is 𝛥𝜌). The
term + 275. 259 𝑚𝑎𝑥 ( 0 , 0. 0282 −𝛥𝜌.)) contributes the largest single coefficient in the
equation and governs predictions across the bulk of the subcritical domain: whenever the
scaled density-contrast falls below its training-median hinge (0.0282 in scaled units), a large
positive increment is added to IFT, consistent with the Macleod–Sugden parachor
framework in which interfacial tension scales with the fourth power of density difference.
The inactivity of MCM and BCM in the subcritical equation is physically interpretable: at
subcritical pressures, the salinity enhancement of brine density is the primary mechanism
by which dissolved salt influences IFT, and 𝛥𝜌) already encodes this information, rendering
an explicit MCM term redundant after backward pruning. The CH4bin indicator
term + 283. 624 𝑚𝑎𝑥 ( 0 , 0. 0282 −𝛥𝜌.))⋅𝐶𝐻 4 _𝑏𝑖𝑛. captures the discrete shift in IFT
response when methane is present (CH4bin = 1, scaled to + 1 ) versus pure CO₂ (scaled
to − 1 ), specifically modulating the density-dependence at low density contrasts. Similarly,
the linear 𝑥CH" term + 38. 3241 max ( 0 , − 0. 3956 −𝑇*,.)⋅𝑥CH",. accounts for the magnitude
of the methane effect at low subcritical temperatures. Hinge functions on 𝑃* introduce
piecewise breakpoints at the training knots ± 0. 7198 (scaled), creating distinct linear
segments for the low-pressure, transitional, and near-critical subcritical sub-regimes.
Taken together, the subcritical equation can be evaluated in a single spreadsheet row,
requiring only inputs for 𝑃, 𝑇, and gas composition (for density calculation and the CH4bin
flag), with brine density used to form Δ𝜌).


6.2 Supercritical MARS Equation

The supercritical production model comprises 35 terms and incorporates seven active
features (out of the ten candidates): reduced pressure (𝑃*), reduced temperature (𝑇*),
squared density difference (Δ𝜌)), monovalent molality (MCM), divalent molality (BCM),
methane mole fraction (𝑥CH"), and nitrogen mole fraction (𝑥N!). The three binary indicator
flags (BCMbin, CH4bin, N2bin) were pruned during the backward selection process, indicating
that the continuous composition features sufficiently capture the structural response in this
regime without requiring discrete steps


## IFTSUPER =^221.^147

```
− 59. 8927 max ( 0 , 0. 4517 −Δ𝜌.))
+ 84. 6131 max ( 0 , 𝑥N!,.− 0. 9652 )
− 32. 995 max ( 0 , 0. 9652 −𝑥N!,.)
− 64. 0876 max ( 0 , 0. 7966 −𝑥CH",.)
+ 3. 4684 max ( 0 , BCM.+ 0. 64 )
− 8. 4184 max ( 0 , − 0. 64 −BCM.)
− 1959. 3 max ( 0 , 𝑇*,.+ 0. 5087 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 34. 4304 max ( 0 , − 0. 5087 −𝑇*,.)⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 3. 1914 max ( 0 , MCM.+ 0. 802 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
− 8. 6816 max ( 0 , − 0. 802 −MCM.)⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 4. 235 max ( 0 , 𝑇*,.+ 0. 7733 )⋅max ( 0 , 0. 9652 −𝑥N!,.)
− 29. 5554 max ( 0 , − 0. 7733 −𝑇*,.)⋅max ( 0 , 0. 9652 −𝑥N!,.)
+ 31. 1754 max ( 0 , 𝑇*,.+ 0. 7165 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 1733. 77 max ( 0 , 𝑇*,.+ 0. 499 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 302. 237 max ( 0 , 𝑇*,.+ 0. 5359 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 28. 3565 max ( 0 , − 0. 9628 −𝑃*,.)⋅max ( 0 , 0. 7966 −𝑥CH",.)
− 136. 493 max ( 0 , 𝑇*,.+ 0. 437 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
− 133. 979 max ( 0 , 0. 7966 −𝑥CH",.)⋅max ( 0 , 𝑥N!,.+ 0. 3434 )
+ 126. 039 max ( 0 , 0. 7966 −𝑥CH",.)⋅max ( 0 , 𝑥N!,.+ 0. 3675 )
+ 8. 6252 BCM.⋅max ( 0 , Δ𝜌.)− 0. 4517 )
− 13. 5765 max ( 0 , 𝑃*,.+ 0. 8438 )⋅max ( 0 , 0. 9652 −𝑥N!,.)
+ 21. 9898 max ( 0 , − 0. 8438 −𝑃*,.)⋅max ( 0 , 0. 9652 −𝑥N!,.)
− 20. 8103 max ( 0 , 𝑥N!,.− 0. 2907 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 24. 6178 max ( 0 , 0. 2907 −𝑥N!,.)⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 24. 9711 max ( 0 , 𝑃*,.+ 0. 7159 )
− 19. 7154 max ( 0 , − 0. 7159 −𝑃*,.)
+ 2. 3966 max ( 0 , BCM.+ 0. 982 )⋅max ( 0 , 0. 9652 −𝑥N!,.)
+ 68. 834 max ( 0 , − 0. 982 −BCM.)⋅max ( 0 , 0. 9652 −𝑥N!,.)
+ 3. 7786 max ( 0 , 𝑇*,.+ 0. 3379 )⋅max ( 0 , 0. 7966 −𝑥CH",.)
+ 5. 372 max ( 0 , − 0. 3379 −𝑇*,.)⋅max ( 0 , 0. 7966 −𝑥CH",.)
− 31. 8591 max ( 0 , 𝑥CH",.+ 0. 7551 )⋅max ( 0 , 0. 9652 −𝑥N!,.)
+ 11. 3604 max ( 0 , 𝑥CH",.+ 0. 5506 )⋅max ( 0 , 0. 4517 −Δ𝜌.))
+ 25. 7311 max ( 0 , − 0. 5506 −𝑥CH",.)⋅max ( 0 , 0. 4517 −Δ𝜌.))
− 133. 286 max ( 0 , − 0. 7159 −𝑃*,.)⋅max ( 0 , − 0. 9192 −𝑇*,.)
```

The primary density-difference hinge − 59. 8927 max ( 0 , 0. 4517 −Δ𝜌.)) encodes the
Macleod–Sugden physical basis shared with the subcritical equation: when the scaled
density contrast falls below the knot at 0.4517, this term applies a large negative correction,
consistent with the reduction in IFT as CO₂ density approaches brine density near the critical
point. The nitrogen terms + 84. 6131 max ( 0 , 𝑥N!,.− 0. 9652 ) and − 32. 995 max ( 0 , 0. 9652 −
𝑥N!,.) are active across nearly the entire supercritical domain, capturing the competing
density and miscibility effects of N₂ impurities. The temperature interaction
term − 1959. 3 max ( 0 , 𝑇*,.+ 0. 5087 )⋅max ( 0 , 0. 4517 −Δ𝜌.)) carries the largest single
coefficient, reflecting the extreme sensitivity of IFT to phase contrast in the near-critical
region. The linear BCM interaction + 8. 6252 BCM.⋅max ( 0 , Δ𝜌.)− 0. 4517 ) models the
differential salting-out effect of divalent cations, which is most pronounced when the
density contrast is high (liquid-like supercritical CO₂).

6.3 Scaler Parameters and Applicability Domain

**Appendix A1** provides the Min–Max scaler parameters required to normalise input features
to [− 1 , 1 ] prior to evaluating the MARS equations. Inputs outside these bounds indicate
extrapolation beyond the training domain and should be flagged as applicability domain (AD)
violations, triggering enhanced uncertainty reporting as described in Section 5.6.

The AD gate should be applied prior to every IFT calculation by verifying that each raw
input 𝑥 satisfies 𝑥;%2≤𝑥≤𝑥;<= for the relevant regime. If one or two features marginally
exceed their bounds by no more than 10% of the scaler range, the prediction should be
classified as Yellow (near-boundary, use with caution) and accompanied by the 90%
conformal prediction interval; if three or more features are outside bounds, or if any single
feature exceeds its bound by more than 10% of the range, the prediction should be classified
as Red (formal extrapolation) and the 95% conformal interval applied. Predictions generated
at Red AD conditions should not be used as primary design inputs for well completion,
storage capacity, or regulatory calculations without supporting experimental measurement
or explicit uncertainty acknowledgement; however, as demonstrated in Section 7.1, the
MARS piecewise-linear structure tends to extrapolate with bounded, monotone behaviour
rather than the exponential divergence sometimes exhibited by neural network
architectures beyond their training convex hull.

It is further noted that the three-tier AD gate, which checks individual feature bounds
independently, does not capture joint-feature interactions. In the supercritical MARS
equation, interaction terms with large coefficients (e.g., +1733.77 × max(0, −0.7733 − Trs) ×
max(0, 0.9652 − xN2s)) can activate at joint input combinations that satisfy individual-
feature bounds but place the prediction in a numerically sensitive regime. Users deploying
the supercritical equation at low-Tr, low-xN2 boundary conditions should apply the 95%
conformal prediction interval regardless of the individual-feature AD classification.


**7. Deployment Scenarios: Applicability Domain and Conformal Intervals at Three GCS
Sites**

```
The production MARS equations and their conformal intervals are now exercised at three
published GCS site characterisations to demonstrate the operational use of the
applicability-domain gate, the conformal prediction envelope, and the architectural
extrapolation behaviour identified in Section 5. These case studies do not constitute field
validation: no in-situ IFT measurement has been performed at any of the three sites, and the
published reference IFT values are themselves machine learning predictions from
contemporaneous models trained on overlapping experimental corpora. Accordingly,
agreement between the present MARS predictions and the published reference predictions
is reported as inter-model concordance rather than as accuracy against ground truth.
```
```
Three geological CO₂ storage projects were selected to span materially different geological
settings, brine chemistries, and thermodynamic regimes: an onshore carbonate aquifer in
the UAE, a basalt formation in Saudi Arabia, and an offshore deep saline aquifer in Vietnam.
All predictions were generated using the production MARS equations presented in Section
6, the global ANN, and the global GMDH models, with applicability domain (AD) status
determined by applying the scaler bounds from Appendix A1 to each input vector prior to
prediction.
```
```
AD status is classified according to a three-tier scheme as shown in Table 13. Green status
indicates that all ten features lie within their respective scaler bounds, placing the
prediction inside the training convex hull (interpolation). Yellow status indicates that one or
two features marginally exceed their scaler bounds by up to 10% of the bound range,
constituting near-boundary extrapolation that warrants caution. Red status indicates that
three or more features are outside bounds, or that any single feature exceeds its bound by
more than 10%, placing the prediction in formal extrapolation territory where model
reliability cannot be guaranteed without supporting measurement.
```
```
Table 1 3. Summary of field-scale case study parameters and applicability domain
classification.
```
**Site Country Formation type P
(MPa)**

```
T (°C) MCM
(mol/kg)
```
```
BCM
(mol/kg)
```
```
AD status
```
UAE Onshore
Carbonate Aquifer UAE^

```
Carbonate saline
aquifer
```
```
34.5–
44.85
```
```
93 –
134 1.90^ 0.0^
```
```
Mixed (Yellow to
Red)
```
Saudi Arabian
Basalt Formation

```
Saudi
Arabia Basalt formation^ 10.0^ 49.85^ 3.419^ 0.0^ Green^
```
Offshore Vietnam
Deep Storage Vietnam^

```
Deep saline
aquifer 21.41^ 100.0^ 0.0^ 0.0^ Green^
```

Together, the three case studies test the model suite across three distinct deployment
scenarios: interpolation on a well-covered pure-water supercritical input (Vietnam),
interpolation at high salinity near the upper edge of the training distribution (Saudi Arabia),
and extrapolation beyond the training pressure envelope for a high-temperature carbonate
aquifer (UAE). Brine chemistry ranges from pure water (MCM = 0) through moderate NaCl
(MCM = 1.90) to high-salinity NaCl (MCM = 3.419), and the geological formations span
carbonate, basalt, and siliciclastic lithologies.

7.1 Case Study 1: UAE Onshore Carbonate Aquifer

The first case study draws on reservoir characterisation data reported by Mouallem et al.
(2024) for an onshore carbonate saline aquifer in the United Arab Emirates that has been
evaluated as a potential CO₂ geological storage site. Four depth intervals spanning a 3,338
ft vertical column (7,527 to 10,865 ft true vertical depth) were characterised, with reservoir
pressure and temperature increasing systematically with depth in accordance with local
geothermal and hydrostatic gradients ( **Table 14** ). The brine is identified as a NaCl-
dominated formation water at a molality of approximately 1.90 mol/kg; no significant
divalent cation contribution is reported. The site is operationally significant for CCS in the
Gulf region, where the combination of high-temperature carbonate reservoirs and proximity
to major industrial CO₂ emitters makes deep saline aquifer storage an attractive mitigation
pathway. The IFT reference values reported by Mouallem et al. (2024) are predictions from
their Gradient Boosting model, trained on overlapping experimental corpora; they are not in-
situ measurements. Accordingly, differences between the present MARS predictions and
the Mouallem et al. values are reported as inter-model spread, not as MARS prediction error.

**Table 14.** Reservoir conditions at each depth interval of the UAE onshore carbonate aquifer
(Mouallem et al. 2024) and corresponding applicability domain status.

```
Depth (ft) P (MPa) T (°C) MCM (mol/kg) BCM (mol/kg) xCH4 xN2 AD status
```
```
7,527 34.50 93.35 1.90 0.0 0.0 0.0 Yellow
8,727 38.22 107.98 1.90 0.0 0.0 0.0 Red
9,727 41.32 120.18 1.90 0.0 0.0 0.0 Red
10,865 44.85 134.06 1.90 0.0 0.0 0.0 Red
```
The pressure axis is the primary driver of the AD outcome. Although the supercritical scaler
upper bound on Pr (9.4187, **Appendix A1** ) corresponds nominally to about 69.5 MPa, the
temperature-stratified coverage of the training set thins substantially above approximately
34.6 MPa once the four-feature joint envelope (P, T, MCM, BCM) is considered. The four UAE
depth intervals therefore exercise the joint AD boundary even though each individual feature
lies within its univariate scaler range. At the shallowest interval (34.50 MPa, 93°C, MCM =
1.90), three of the four features are within 5% of their joint-coverage edge, yielding a Yellow


```
classification; the three deeper intervals (38.22, 41.32, 44.85 MPa) move further into the
sparsely-covered joint region and are reclassified as Red.
```
```
Table 15 reports MARS predictions with their conformal prediction intervals alongside the
ANN and GMDH point predictions at each depth interval. Conformal PI levels are AD-
dependent: the 90% PI (±3.76 mN/m, Table 12 ) is applied at the Yellow depth point and the
95% PI (±5.07 mN/m) at the three Red depth points, consistent with the practitioner
deployment protocol described in Section 8.5. The reference column reports the ML-
predicted IFT values from Mouallem et al. (2024); it does not represent experimentally
measured ground truth.
```
```
Table 15. MARS conformal predictions and ANN/GMDH point predictions at four depth
intervals of the UAE onshore carbonate aquifer. The reference column reports ML-predicted
IFT from Mouallem et al. (2024), not experimentally measured values; differences are inter-
model spread, not prediction error against ground truth.
```
**Depth (ft) AD Comparator prediction (mN/m)ML ANN (mN/m) GMDH (mN/m) MARS (mN/m) MARS PI (mN/m)**

7,527 Yellow 28.95 35.23 32.65 24.60 24.60 ± 3.76 (90%)

8,727 Red 29.73 34.95 35.42 24.54 24.54 ± 5.07 (95%)

9,727 Red 30.34 35.41 35.94 28.00 28.00 ± 5.07 (95%)

10,865 Red 30.93 35.63 36.37 29.41 29.41 ± 5.07 (95%)

```
MARS PI level is AD-dependent: 90% PI (±3.76 mN/m) at Yellow; 95% PI (±5.07 mN/m) at Red. Half-widths are
from Table 12. The reference column is an ML prediction from Mouallem et al. (2024), not an in-situ
measurement.
```
```
The predictions across the four depth intervals are instructive about both architectural
behaviour and inter-model spread. At the shallowest point (Yellow AD, 7,527 ft), the three
architectures span approximately 11 mN/m: ANN (35.23 mN/m), GMDH (32.65 mN/m), and
MARS (24.60 mN/m), relative to the Mouallem et al. reference of 28.95 mN/m. Given that the
reference is itself a model prediction, this spread quantifies the disagreement among
contemporaneous ML models at near-boundary pressure conditions; it is not a ranking of
accuracy against truth. The Mouallem et al. reference lies outside the MARS 90% PI at this
depth point [20.84, 28.36], reflecting the structural divergence between the MARS
piecewise-linear response surface and the Gradient Boosting response surface at
conditions near-boundary for both corpora.
```
```
As depth increases and pressure enters Red AD territory, the three architectures diverge
further in their extrapolation behaviour. The supercritical ANN (utilizing tanh activations)
plateaus at an IFT value of approximately 34–36 mN/m regardless of the increasing depth
and temperature, exhibiting the saturation behaviour characteristic of asymptotic bounded
architectures that have reached the boundary of their learned input manifold. GMDH
exhibits a momentary inflection and plateau in this specific regime prior to its characteristic
```

polynomial divergence. MARS, by contrast, exhibits structural convergence: predictions
increase progressively from 24.60 mN/m at 7,527 ft to 29.41 mN/m at 10,865 ft, consistent
with the pressure-IFT trend established in the training data. This is attributable to the
piecewise-linear extrapolation property of MARS hinge functions (Section 8.1), which
continue along the slope of the outermost training segment rather than plateauing at the
training boundary. By 10,865 ft, the MARS prediction of 29.41 ± 5.07 mN/m (95% PI) and the
Mouallem et al. reference of 30.93 mN/m show closer inter-model concordance than at
shallower depths, a pattern consistent with the shared underlying physical trend at elevated
supercritical pressures. Both MARS and the Mouallem et al. model are anchored in the same
experimental data distribution; the narrowing spread reflects shared P–T physics, not
evidence of accuracy against an independent standard.

For practitioners deploying models at UAE-type conditions, the supercritical MARS equation
is recommended for all four depth intervals, applied with the 90% conformal PI at the Yellow
depth point and the 95% conformal PI at the three Red depth points. ANN and GMDH
predictions at Red AD conditions should not be used as primary inputs for storage capacity
or injectivity calculations without apparatus-specific calibration at pressures above 35 MPa.

7.2 Case Study 2: Saudi Arabian Basalt Formation

The second case study is drawn from Turkson et al. (2026), who evaluated CO₂
mineralisation potential in Saudi Arabian basalt formations using an advanced probabilistic
ensemble framework ( **Table 16** ). The target storage zone was characterised at P = 10 MPa
and T = 49.85°C, placing CO₂ firmly in the supercritical phase (T > 31.04°C). The brine is a
high-salinity NaCl formation water at MCM = 3.419 mol/kg, which approaches the upper
boundary of the supercritical training distribution (scaler maximum: 4.95 mol/kg),
constituting a near-edge interpolation scenario within the Green AD zone. No divalent cation
contribution is reported (BCM = 0), and the gas phase is treated as pure CO₂. The IFT
reference value from Turkson et al. (2026) is a prediction from their ensemble probabilistic
framework, not an in-situ measurement; differences between the present predictions and
the Turkson et al. value are inter-model spread.

**Table 16.** Reservoir conditions for the Saudi Arabian basalt formation (Turkson et al. 2026).

```
P (MPa) T (°C) MCM (mol/kg) BCM (mol/kg) xCH4 xN2 AD status
10.0 49.85 3.419 0.0 0.0 0.0 Green
```
**Table 17** reports MARS predictions with the 80% conformal PI alongside ANN and GMDH
point predictions. The 80% PI (±2.25 mN/m, **Table 12** ) is applied, as Green AD indicates the
input lies within the training manifold and test-calibrated intervals are appropriate
(supercritical UIF ≈ 1.0 for both EV laboratories; Section 5.4).


**Table 1 7.** MARS conformal prediction and ANN/GMDH point predictions for the Saudi
Arabian basalt formation. The reference column reports ML-predicted IFT from Turkson et
al. (2026), not experimentally measured values; differences are inter-model spread, not
prediction error against ground truth.

```
AD Comparator ML prediction (mN/m) ANN (mN/m) GMDH (mN/m) MARS (mN/m) MARS 80% PI (mN/m)
```
```
Green 49.00 42.32 43.74 45.32 45.32 ± 2.25
```
_80% PI half-width (±2.25 mN/m) from Table 12 , supercritical model; Green AD._

All three architectures predict IFT in the range 42–46 mN/m, with MARS (45.32 mN/m)
showing the closest inter-model concordance with the Turkson et al. reference of 49.00
mN/m. The MARS 80% PI [43.07, 47.57] does not enclose the Turkson et al. reference value;
however, the Turkson et al. value lies within the 95% PI [40.25, 50.39], confirming that the
discordance is not extreme relative to the full uncertainty envelope. The consistent direction
of the inter-model spread all three architectures predicting below the Turkson et al.
reference, is attributable to the sparse coverage of high-salinity conditions in the training
corpus rather than an architecture-specific failure: the experimental pool is sparse at MCM
> 3 mol/kg, and all three models carry a salinity-IFT response surface calibrated
predominantly on lower-molality data. The Turkson et al. ensemble model, which may draw
on different training data or an expanded salinity range, can project a higher IFT at this
molality without either result being adjudicated as correct; no laboratory measurement at
these conditions exists to determine which prediction is closer to the physical value.
Practitioners deploying any model at high-molality conditions (MCM > 3 mol/kg) should
apply the 95% conformal PI and acknowledge the potential for systematic IFT
underestimation, particularly in basalt or evaporite-bearing formations where hypersaline
brines are common.

7.3 Case Study 3: Offshore Vietnam Deep Storage

The third case study is based on Safaei-Farouji et al. (2022), who applied optimal random
forest modelling to assess CO₂ storage potential in a deep saline aquifer offshore Vietnam
( **Table 18** ). The storage formation is characterised at P = 21.41 MPa and T = 100°C, with the
formation fluid described as fresh or near-pure water (MCM = 0, BCM = 0). The conditions
place CO₂ in the supercritical regime and the input vector squarely within the water-
supercritical training domain, yielding a Green AD classification with high prediction
confidence. The IFT reference value from Safaei-Farouji et al. (2022) is a prediction from their
optimal random forest model, not an in-situ measurement.

**Table 18.** Reservoir conditions for the offshore Vietnam deep saline aquifer (Safaei-Farouji
et al. 2022).


```
P (MPa) T (°C) MCM (mol/kg) BCM (mol/kg) xCH4 xN2 AD status
21.41 100.0 0.0 0.0 0.0 0.0 Green
```
**Table 19** reports MARS predictions with the 80% conformal PI alongside ANN and GMDH
point predictions.

**Table 19.** MARS conformal prediction and ANN/GMDH point predictions for the offshore
Vietnam deep storage formation. The reference column reports ML-predicted IFT from
Safaei-Farouji et al. (2022), not experimentally measured values; differences are inter-
model spread, not prediction error against ground truth.

```
AD Comparator ML prediction(mN/m) ANN (mN/m) GMDH (mN/m) MARS (mN/m) MARS 80% PI (mN/m)
```
```
Green 27.89 28.40 31.00 29.65 29.65 ± 2.25
```
_80% PI half-width (±2.25 mN/m) from Table 12 , supercritical model; Green AD._

At Vietnam conditions (Green AD, pure-water supercritical, well covered by Liu et al. 2017),
all three architectures predict IFT in the range 28–31 mN/m. The Safaei-Farouji et al.
reference of 27.89 mN/m lies within the MARS 80% PI [27.40, 31.90], confirming that the
MARS uncertainty envelope is well-calibrated for this regime. The reference prediction is
near the lower end of the conformal band, consistent with the finite-sample downward bias
of the 80% conformal quantile documented in Section 5.6 (empirical EV coverage: 75.0% at
80% nominal). Among the three architectures, ANN (28.40 mN/m) shows the closest inter-
model concordance with the Safaei-Farouji et al. reference (inter-model spread of 0.51
mN/m), while MARS (29.65 mN/m) and GMDH (31.00 mN/m) are progressively higher. The
overall spread among architectures at this single within-AD input point is approximately 3
mN/m (ANN to GMDH), a reminder that inter-model disagreement persists even under
favourable deployment conditions and that reporting a conformal PI alongside any single
model prediction is the operationally appropriate practice. This result confirms that, within
the training manifold (Green AD, pure-water supercritical regime), multiple architectures
provide credible IFT estimates; model selection based on external validation performance
remains the appropriate deployment criterion for choosing among them.

7.4 Synthesis of Case Study Findings

The three case studies collectively demonstrate the operational workflow for deploying the
MARS equations: apply the AD gate, select the conformal PI level (80% for Green, 90% for
Yellow, 95% for Red), and report the result as a MARS prediction with its associated interval.
Agreement or disagreement with contemporaneous ML predictions from other studies is
informative about inter-model concordance and about regions where the training corpus is
sparse, but it does not constitute validation against ground truth, since no in-situ IFT
measurement has been performed at any of the three sites.


Within-AD MARS predictions (Green status) fall within the calibrated 80% conformal band
in both the Saudi Arabia and Vietnam cases, confirming that test-calibrated intervals are
operationally reliable for deployment conditions well-represented in the training manifold.
At out-of-AD conditions (Yellow/Red, UAE), the piecewise-linear structure of MARS
produces bounded, physically coherent extrapolation predictions that increase
consistently with increasing pressure and temperature along the outermost training slope,
while ANN and GMDH predictions plateau or diverge. This architectural contrast, not a
comparison against ground truth, is the primary diagnostic finding of the UAE case study.

The primary dataset limitation revealed by the case studies is the sparse coverage of high-
salinity conditions: at MCM > 3 mol/kg, all three architectures show consistent inter-model
divergence from the Turkson et al. reference, indicating that the training corpus
underrepresents the salinity-IFT response surface above 3 mol/kg NaCl. Collection of
additional high-quality IFT data at MCM = 3–5 mol/kg under supercritical P–T conditions is
the highest-priority experimental direction for improving model reliability at hypersaline
GCS targets.

**8. Discussion**

8.1 Architectural Extrapolation Properties and the EV Reversal

The central finding of this study is that external validation reverses the model ranking in both
the subcritical and supercritical regimes. This reversal is the direct consequence of
architectural extrapolation properties inherent to each model class, not of training data
quality, hyperparameter choices, or sampling artefacts. Understanding this mechanism has
implications that extend well beyond CO₂–brine IFT modelling.

MARS linear extrapolation behaviour (Section 4.3) explains why MARS does not exhibit
catastrophic generalisation failure under cross-laboratory evaluation. In the subcritical
regime, MARS retains EV R² = 0.581 against the apparatus-offset Li et al. (2012) source while
the ANN inverts to EV R² = −0.483 and the GMDH diverges numerically. In the supercritical
regime, where no apparatus-level offset is present, MARS achieves EV nRMSE = 5.62%,
indistinguishable from its test nRMSE of 5.60%. The residual 17.00% subcritical EV nRMSE
reported here is therefore not an architectural failure of MARS but the residual apparatus
offset at Li et al. (2012) (Section 5.4), which would degrade any architecture trained on the
present corpus and which is addressed by the UIF framework rather than by architectural
redesign.

ANN architectures with ReLU or tanh activations have no analogous extrapolation bound. A
network that has learned a steeply sloped response surface in one region of feature space
continues that slope indefinitely on inputs displaced in the corresponding direction,
because the activation functions impose no upper limit on the rate of change of the network
output. The subcritical ANN EV R² = −0.483 is the consequence of this unbounded
extrapolation: the high-dimensional response surface, optimised for within-laboratory


inputs during training, extrapolates non-physically onto the input manifold of the Li et al.
(2012) and Aggelopoulos et al. (2010) laboratories. An EV R² below zero indicates that the
ANN produces predictions further from the true values than the naive constant-mean
estimator, a complete inversion of model utility. The supercritical ANN confirms the same
mechanism at a less catastrophic scale: the 4.7-fold test-to-EV degradation (3.77% to
17.82% nRMSE) reveals unbounded extrapolation operating on a feature manifold that is
somewhat less displaced from the training distribution than the subcritical EV set.

GMDH polynomial bases diverge algebraically outside the training domain. Each GMDH
neuron evaluates a second-degree polynomial of its two inputs; across five network layers,
the effective polynomial degree of the output is at least 2⁵ = 32. High-degree polynomial
functions grow without bound on inputs outside the fitting range, the polynomial analogue
of Runge's phenomenon.

The subcritical GMDH EV nRMSE = 31,999% represents amplification of the out-of-
distribution polynomial error by approximately 5,150-fold relative to test performance
(6.21% test nRMSE). The supercritical GMDH is considerably less extreme (EV nRMSE =
23.59%, EV R² = 0.036), consistent with the supercritical EV inputs being less displaced from
the training manifold. The decision to retain GMDH in the subcritical comparison without
intervention (i.e., without numerical clipping of divergent predictions) is intentional:
excluding or clipping GMDH would obscure the theoretically predicted failure mode of high-
degree polynomial networks applied to out-of-distribution inputs, which is the direct
consequence of the 2⁵ = 32-degree effective polynomial order documented in Section 4.4.

Retaining the divergent result provides the clearest possible empirical demonstration that
architecture selection, not hyperparameter tuning is the determinant of EV generalisation.
A practitioner who selected GMDH on test-set performance alone (nRMSE = 6.21%) would
deploy a model that produces predictions of order 10⁴ mN/m on data from an unseen
apparatus; the subcritical EV result is included precisely to make this failure visible and
attributable.

This finding extends beyond CO₂–brine IFT. Any physical property prediction problem in
which deployment will encounter data from instruments, measurement campaigns, or
geological settings not represented in training should be expected to exhibit within-to-cross-
distribution performance degradation for smooth extrapolating architectures. Piecewise
linear models, or models with explicit extrapolation-limiting regularisation, are structurally
better suited to such deployment contexts, and this preference should be incorporated into
model selection criteria for any geoscience ML application where field deployment will differ
systematically from the training environment.

8.2 The Laboratory-Offset Problem and the UIF Framework

The Uncertainty Inflation Factor (UIF), defined as the ratio of per-laboratory EV nRMSE to
overall test nRMSE, is introduced here as an operational deployment diagnostic. The ratio


itself is arithmetically simple and does not require specialist computation; its contribution
lies in the three-tier decision protocol (UIF < 1.5: use test-calibrated intervals; UIF 1.5–2.5:
widen to 90% PI; UIF ≥ 2.5: widen to 95% PI or recalibrate) that translates the ratio into a
specific, actionable interval-widening instruction at deployment time. Prior reviews have
acknowledged inter-laboratory IFT scatter qualitatively (Mouallem et al., 2024; Yekeen et al.,
2021; Zhang and Wang, 2023), but no prior CO₂–brine IFT ML study has, to the best of the
authors' knowledge, attributed per-laboratory performance gaps explicitly to apparatus-
level offsets or provided a scalar criterion for conformal interval adjustment. The UIF
thresholds (1.5 and 2.5) are presented as operationally motivated reference points
calibrated on the two subcritical EV laboratories; formal type-I/II analysis of the optimal
threshold under a decision-theoretic framework (e.g., expected caprock assessment error
cost) is acknowledged as a valuable extension beyond the scope of this study.

The per-laboratory decomposition (Section 5.4) establishes that the subcritical EV gap is
apparatus-dependent rather than chemistry-dependent: the six Na₂SO₄ rows from Li et al.
(2012) achieve nRMSE = 7.29% while NaCl and KCl rows from the same apparatus -
chemistries present in training from other laboratories, exhibit the same systematic
+11.09% over-prediction bias (UIF = 3.41). The error follows the apparatus, not the
chemistry.

The 40.3% empirical coverage at the 80% nominal level for Li et al. (2012) constitutes formal
statistical evidence of distributional non-exchangeability under the conformal framework
(Section 5.6), confirming that the apparatus-level offset is not an informal observation but a
statistically certifiable distributional shift.

The UIF framework provides practitioners with a three-tier decision protocol for deployment
interval selection. A UIF below 1.5 indicates that test-calibrated intervals are adequate for
the measurement source in question. A UIF between 1.5 and 2.5 suggests widening to the
90% prediction interval. A UIF at or above 2.5, as in the case of Li et al. (2012), triggers use
of the 95% prediction interval or, preferably, acquisition of apparatus-specific calibration
data to recalibrate the conformal quantile directly. For any new laboratory whose UIF can be
estimated from a small validation sample (as few as 10–20 observations), the framework
provides a principled basis for widening the conformal intervals. A UIF near unity implies that
the test-calibrated intervals are adequate; a UIF substantially above 2 triggers automatic
interval widening, preventing overconfident predictions in field deployment.

This framework directly addresses requirements for geological carbon storage (GCS)
regulatory compliance. Multi-million dollar injection decisions require P10/P50/P90 IFT
bounds for caprock integrity assessment. For deployment scenarios involving
measurement apparatus with elevated UIF, the UIF framework ensures that the conformal
intervals are appropriately widened before propagation through the Young–Laplace
equation, preventing the underestimation of capillary entry pressure uncertainty caused by
applying test-calibrated intervals to out-of-distribution sources.


8.3 Regime Asymmetry

The roughly 3-fold difference in EV nRMSE between the subcritical regime (17.00%) and the
supercritical regime (5.62%) reflects a structural asymmetry in training data coverage that
has direct implications for GCS site selection and model deployment strategy.

In the supercritical regime, Liu et al. (2017) contributes 38.4% of the pooled dataset (1,865
total observations), spanning 5–50 MPa and 30–150°C across NaCl-dominated brine
chemistries. This large, systematic coverage enables the supercritical MARS model to
generalise to unseen laboratories with EV nRMSE within 0.02 percentage points of its test
nRMSE, confirming near-exchangeable performance across apparatus. For supercritical
GCS targets which account for the majority of planned storage sites at depths exceeding 800
m, the MARS production equation can be deployed directly with test-calibrated 80%
conformal prediction intervals, without UIF adjustment, provided the target laboratory UIF
is below 1.5.

The subcritical regime presents a materially different situation. The EV gap (1 7 % vs. 5. 46 %
test nRMSE, a 3. 1 - fold degradation) is driven by the apparatus-level offset of Li et al. (2012),
confirmed by UIF = 3.41 and a systematic +11.09% over-prediction bias across all brine
chemistries from that source. Subcritical GCS targets typically shallow saline formations at
depths of 300–800 m, will therefore require UIF assessment from a small apparatus-specific
validation sample (10–20 observations) before the 80% conformal interval can be applied
with adequate coverage. Sites that cannot provide such calibration data should apply the
95% conformal interval (UIF-adjusted) as a conservative default. This practical distinction
that supercritical sites can use the production equation directly; subcritical sites require
apparatus-specific UIF assessment is the principal deployment-relevant consequence of
the regime asymmetry identified in this study.

8.4 Benchmarking Against Prior ML-IFT Studies

The present study evaluates ML-IFT models under a complete-laboratory cross-boundary
protocol in which all data from two or more entire measurement campaigns are excluded
from training and reserved for locked EV assessment; a methodology whose novelty relative
to the existing literature is documented in the contribution list (Section 1) and in **Table 3**.
Prior studies report metrics from within-laboratory random splits (Section 2.1); the present
study demonstrates that these do not predict cross-laboratory performance.

**Table 20** situates the present study in the context of representative prior ML-IFT models. The
comparison reveals a fundamental methodological distinction: all prior studies report test-
set performance from within-laboratory random splits, while the present study reports both
within-laboratory test performance and cross-laboratory EV performance as distinct and
non-equivalent metrics.

```
Table 20. Benchmarking against selected prior ML models for CO₂–brine IFT prediction.
```

**Reference Architecture Dataset (n) (reported)Test R²**

```
EV
protoc
ol
```
```
Validated R² UQ
```
```
Explicit
equati
on
```
```
Deploym
ent tool
```
Amooie et al.
(2019)

```
MLP-ANN
ensemble ~2,517^ 0.997^
```
```
Rando
m split Not evaluated^ No^ No^ No^
```
Zhang et al.
(2020a) XGBoost^ ~2,346^ 0.993^

```
Rando
m split Not evaluated^ No^ No^ No^
```
Arif et al. (2016) SVR ~100 0.985 (^) m splitRando Not evaluated No No No
Fan et al.
(2025)
Multibranch
CNN
~1,716 0.992 Rando
m split
Not evaluated No No No
Amar (2021) Genetic Programming ~500 0.970 (^) m splitRando Not evaluated No Yes No
Davari and
Bigdeli (2025)
Symbolic
Regression ~1,830^ 0.940^
Rando
m split Not evaluated^ No^ Yes^ No^
Turkson et al.
(2026)
XGBoost +
GWO
~2,000
+ ~0.990^
Cross-
validati
on + EV
Achieved Yes (MC) No No
Present study
(sup) MARS^ 1,^815
0.928
(test)
Cross-
lab EV **0.945**^
Yes
(conformal) Yes^ Yes (web)^
Present study
(sub) MARS^ 1,40^0
0.949
(test)
Cross-
lab EV 0.581^
Yes
(conformal) Yes^ Yes (web)^
The supercritical MARS EV R² = 0.945 is directly comparable to the test-set R² values
reported by prior studies (0.94–0.997), because both represent generalisation to data not
used in training. The distinction is that EV data in the present study originate from entirely
separate measurement apparatus, while prior test sets originate from the same apparatus
as training data. This comparison suggests that genuine cross-laboratory accuracy is
achievable at levels competitive with reported within-laboratory accuracy, provided that
architectures with stable extrapolation properties are employed. Conversely, the subcritical
EV R² = 0.581 reveals that the competitive within-laboratory accuracy of ANN (test R² > 0.96)
does not persist when the deployment environment differs systematically from the training
distribution. The supercritical MARS result provides an existence proof that within-
laboratory and cross-laboratory accuracy can converge; the subcritical gap identifies the
conditions under which they diverge.
The present study additionally provides the only functionally transparent, full-equation ML-
IFT model coupled with split conformal prediction intervals and deployed in a publicly
accessible tool. While Turkson et al. (2026) provide the closest prior comparator in this


corpus, reporting hold-out test performance on a stratified split of the same pooled
database with Monte Carlo uncertainty bounds. Their hold-out protocol does not constitute
cross-laboratory independence (the hold-out rows share apparatus with training rows), so
the EV nRMSE reported here is not directly comparable to the test nRMSE reported in that
work. No prior study, to the best of the authors' knowledge, has simultaneously delivered a
deployable closed-form equation, cross-laboratory external validation, and calibrated
conformal prediction intervals in a single framework.

8.5 Practical Implications for GCS Engineering

The MARS equations and associated conformal prediction intervals provide a deployable
framework for three categories of GCS engineering application. Each application benefits
from the combination of explicit algebraic transparency, enabling manual audit and direct
simulator integration, and calibrated uncertainty quantification.

For caprock integrity assessment, the MARS prediction combined with its conformal PI can
be propagated directly through the Young–Laplace equation. Engineers can propagate the
80% and 95% conformal IFT intervals through this equation to obtain corresponding
capillary entry pressure bounds, providing P10 and P90 estimates of caprock seal capacity
without requiring Monte Carlo simulation. This propagation is linear in IFT, so the interval
widths scale directly: a ±2.25 mN m⁻¹ supercritical 80% PI translates to a proportional
uncertainty range in capillary entry pressure across the pore size distribution.

For regulatory compliance, the conformal PI structure provides the P10/P50/P90
probabilistic bounds required for site approval risk assessment frameworks in multiple GCS
regulatory jurisdictions. UIF-adjusted intervals, widened to 90% or 95% nominal coverage
for apparatus sources with UIF above 1.5, ensure that regulatory submissions employ
conservative uncertainty bounds appropriate to the measurement quality available for the
specific site characterisation campaign.

To facilitate immediate industry deployment, a dedicated open-access web application
available at https://todak2000.github.io/ift-safepredict/ embeds both production MARS
equations alongside the conformal UQ framework. The interactive tool accepts the relevant
reservoir parameters as inputs, returns the predicted IFT with regime-specific conformal
prediction interval half-widths, and automatically flags input configurations that fall outside
the validated training domain.

For new GCS site characterisation campaigns, the recommended protocol is to collect 15–
20 IFT measurements from the site-specific measurement apparatus and compare against
production model predictions. The ratio of observed nRMSE to the production test nRMSE
provides a direct UIF estimate, enabling calibrated deployment intervals from the outset of
the measurement programme. This protocol imposes minimal additional experimental cost
while substantially reducing the risk of overconfident caprock assessments.


8.6 Limitations

Four limitations of the present study are acknowledged, each of which defines a specific
direction for future research.

```
(i) The subcritical EV performance (EV R² = 0.581) is adequate for screening-level
estimation but insufficient for high-fidelity reservoir simulation requiring tight IFT
bounds. This limitation is principally attributable to the apparatus-level offset at
Li et al. (2012) (UIF = 3.41) rather than to a fundamental deficiency in the
subcritical MARS equation structure: when the Li et al. (2012) data are excluded,
the remaining subcritical EV performance at Aggelopoulos et al. (2010) yields EV
nRMSE = 7.12% and R² = 0.859, which is commensurate with test-set accuracy.
The path to improved subcritical EV performance is therefore not architectural
refinement but additional training data from apparatus types exhibiting high UIF,
which would reduce the systematic offset by exposing the model to the
corresponding measurement distribution during training.
```
```
(ii) Out-of-range extrapolation occurs at extreme conditions in both regimes. Seven
subcritical EV predictions (3.7% of the 188 EV observations) marginally exceed
the training maximum of 78.88 mN m⁻¹, all at extreme high-salinity, low-pressure
conditions specific to Li et al. (2012). Two supercritical EV predictions (2.2% of 92
observations) fall marginally below 12.4 mN m⁻¹ at the high-pressure Pereira et
al. (2016) conditions. Both are boundary effects at the training domain edge
rather than failures within the core operating envelope, but practitioners
deploying the models at conditions approaching or exceeding the scaler bounds
should treat predictions in these regions with additional caution and flag them as
domain-extrapolated estimates in any regulatory submission.
```
```
(iii) Dataset concentration is a third structural limitation. Liu et al. (2017) accounts
for 38.4% of the total dataset, creating a training distribution that is well-
calibrated for NaCl-dominated brine systems in the 5–50 MPa and 30–150°C
pressure–temperature envelope of that study, but potentially over-representing
NaCl relative to more complex formation water chemistries encountered in real
GCS targets. Generalisation to supercritical conditions with high divalent cation
concentrations outside the EV range, or to CO₂ streams with high N₂ content (xN₂
> 0.3), is less well established than the core NaCl–CO₂–water performance, and
predictions in these regions should be accompanied by explicit domain-flagging.
```
```
(iv) Extrapolation to novel geochemical conditions, specifically high divalent cation
concentrations at supercritical pressures and CO₂–N₂ mixtures at high nitrogen
mole fractions, represents the outermost limitation of the current framework. The
present dataset contains limited coverage of Ca²⁺ and Mg²⁺ dominated brines at
supercritical conditions beyond the Aggelopoulos et al. (2011) observations, and
the SO₄²⁻ chemistry contribution to the full training corpus derives entirely from
```

```
Li et al. (2012), which is withheld in EV. While the EV decomposition confirms that
SO₄²⁻ absence is not the primary driver of subcritical performance gap, explicit
incorporation of mixed-anion brine observations from multiple independent
laboratories into future training data compilations remains an open
methodological requirement for modelling the complex formation waters that
characterise deep saline aquifer targets at many GCS candidate sites.
```
**9. Conclusions**

This study evaluated three machine learning architectures for CO₂–brine interfacial tension
prediction under a between-laboratory external validation protocol, applied to a 3,265-
observation dataset compiled from 16 experimental campaigns spanning two
thermodynamic regimes. The central finding is that conventional test-set evaluation, based
on random row-level splitting within the same laboratory corpus, is an unreliable basis for
assessing the cross-laboratory generalisation required for field deployment of ML-IFT
models. Six principal conclusions are drawn.

(i) External validation reverses the model ranking in both thermodynamic
regimes. Under conventional test-set evaluation, the ANN achieves the best
performance in both the subcritical regime (nRMSE = 4.57%, R² = 0.964) and the
supercritical regime (nRMSE = 3.77%, R² = 0.967), with MARS ranked second and
GMDH third. Under cross-laboratory external validation, the ranking inverts
completely in both regimes. The ANN collapses to EV R² = −0.483 in the subcritical
regime and EV nRMSE = 17.82% supercritically; GMDH diverges numerically on
subcritical EV data, producing nRMSE = 31,999% and EV R² = −1,483,183. MARS is
the sole architecture that remains predictively useful in both regimes, confirming
that test-set accuracy derived from within-laboratory splits does not predict cross-
laboratory generalisation. This reversal is the primary empirical finding of the study
and has direct consequences for model selection in GCS deployment contexts
where predictions must be made for apparatus types not represented in training
data.

(ii) The supercritical MARS model achieves between-laboratory generalisation at a level
sufficient for field deployment. The supercritical MARS EV nRMSE of 5.62% is
statistically indistinguishable from its test-set nRMSE of 5.60%, and the
corresponding EV R² of 0.945 confirms that the model captures the dominant
variance in IFT across unseen supercritical laboratory conditions. The Uncertainty
Inflation Factors for both supercritical EV laboratories confirm the absence of
apparatus-level distributional shift. This is one of the first ML-IFT model studies for
which test-set and cross-laboratory EV performance are demonstrably equivalent,
providing the empirical foundation for deployment confidence under the stated
conditions.


(iii) The subcritical external validation gap is attributable to an apparatus-level
measurement offset rather than a deficiency in feature engineering. The 3.1-fold
discrepancy between subcritical test-set nRMSE (5.46%) and EV nRMSE (17.00%) is
driven primarily by a systematic +11.09% over-prediction bias at Li et al. (2012),
which carries a UIF of 3.41, indicating that true prediction uncertainty at that
laboratory is 3.41 times larger than implied by the test-calibrated interval. The bias is
uniform across all brine compositions measured at the Li et al. (2012) apparatus:
Na₂SO₄ brine observations, which represent a chemical composition not present in
the subcritical training corpus, achieve subcritical EV nRMSE of 7.29%, confirming
that the performance gap does not arise from missing ionic chemistry in the feature
set. The diagnosis indicates that additional feature engineering cannot close the
subcritical EV gap without explicit representation of apparatus-level calibration
offsets in the training data.

(iv) The conformal prediction and UIF framework provides quantitative deployment
reliability guidance that is actionable at the per-laboratory level. The 80% conformal
prediction interval for the subcritical MARS model, calibrated on the test set,
achieves only 45.7% empirical coverage on the EV set, constituting formal statistical
evidence of distributional non-exchangeability between subcritical EV and test data
under the exchangeability assumption of split conformal prediction. The UIF
translates this statistical evidence into operational guidance. In contrast, the
supercritical regime achieves 75.0% empirical coverage at the 80% nominal level, an
undercoverage of 5 percentage points relative to the marginal exchangeability
guarantee. This is small enough to be consistent with mild rather than catastrophic
distributional shift between training and EV laboratories, and is substantially closer
to nominal than the 34.3-percentage-point subcritical gap; nevertheless,
deployment-grade conformal coverage at the 90% and 95% nominal levels is
achieved (98.9% and 100.0% respectively), supporting the use of the wider intervals
as the primary uncertainty quantification artefact for the supercritical model in field
deployment. The UIF framework thereby provides a quantitative criterion for
differentiating laboratories at which model predictions may be directly trusted from
those requiring interval inflation prior to deployment.

(v) Explicit closed-form MARS equations for both regimes satisfy physical compliance
requirements and enable deployment without machine learning infrastructure. The
subcritical and supercritical production MARS models are fully specified as closed-
form arithmetic expressions containing 16 terms and 35 terms, respectively, with the
subcritical model employing five active features and the supercritical model
employing all ten engineered features. Both models predict within the training IFT
bounds for 96.3% of subcritical EV observations and 97.8% of supercritical EV
observations; the seven (3.7%) subcritical and two (2.2%) supercritical predictions
falling marginally outside the training envelope occur at extreme-condition
boundaries discussed in Section 8.6 and should be flagged as domain-extrapolated
in any regulatory submission. The symbolic specification of these models, reported


```
with all scaler parameters in the companion tables, enables evaluation using only
arithmetic operations in any computational environment, removing the dependency
on trained model files, machine learning libraries, and specialist software that
characterises ANN and GMDH deployments.
```
(vi) Field-scale case study evaluation confirms practical utility of the supercritical MARS
model for GCS site characterisation. Application of the MARS models to three field-
scale GCS case studies demonstrates that the supercritical model produces IFT
predictions consistent with independently reported values from operational site
data, within the conformal prediction intervals calibrated at the 80% level. The case
studies span a range of reservoir pressures, temperatures, and brine salinities
representative of actively monitored GCS sites, confirming that the supercritical
model generalises beyond the laboratory domain to conditions encountered in
practice. The subcritical MARS model provides useful predictions for case study
conditions within the training distribution, with the UIF framework indicating when
apparatus-specific interval inflation should be applied. These results confirm that
between-laboratory EV performance, rather than test-set accuracy, is the
appropriate criterion for selecting ML-IFT models for field-scale GCS applications.

**Data and Code Availability**

The compiled 3,265-point CO₂–brine IFT dataset, reproducible pipeline scripts, trained
model files, conformal calibration sets, and scaler parameters are available at
https://doi.org/10.5281/zenodo.20242554. SHA-256 hashes of all locked EV data files are
recorded in the pipeline logs to support full reproducibility of the external validation results
reported in this study.

**Declaration of generative AI and AI-assisted technologies in the manuscript
preparation process**

During the preparation of this work the author(s) used NotebookLM in order to cross-check
information, summarize reference papers, and act as a second verifier for correctly
addressing each author's work. After using this tool/service, the author(s) reviewed and
edited the content as needed and take(s) full responsibility for the content of the published
article.


**CRediT Author Statement**

_Daniel Tosin Olagunju_ : Conceptualization, Methodology, Investigation, Data curation,

Writing – original draft, Writing – review & editing, Visualization; _Okorie Ekwe Agwu_ :

Conceptualization, Supervision, Writing – review & editing, Project administration;

_Muhammad Aslam Md Yusof_ : Supervision, Writing – review & editing.

**Funding & Acknowledgement**

This research was carried out with funding support from the YUTP scheme (Grant No.

015LC0–585), which is sincerely appreciated. The authors also wish to express their

gratitude to the Department of Petroleum Engineering and the Centre for Research and

Development (COReD), Universiti Teknologi PETRONAS, Malaysia, for providing the

academic and research environment that facilitated this study.

**Declaration of Competing Interests**

The authors declare no competing financial or personal interests that could have appeared
to influence the work reported in this paper.

**References**

Ajayi, T., Awolayo, A., Gomes, J. S., Parra, H., & Hu, J. (2019). Large scale modeling and
assessment of the feasibility of CO2 storage onshore Abu Dhabi. Energy, 185, 653–670.
https://doi.org/10.1016/j.energy.2019.07.052

Amar, M. (2021). Towards improved genetic programming based-correlations for predicting
the interfacial tension of the systems pure/impure CO2-brine. Journal of the Taiwan Institute
of Chemical Engineers, 127, 186–196. https://doi.org/10.1016/j.jtice.2021.08.010

Amar, M., Youcefi, M.R., Alqahtani, F.M., Djema, H., & Ghasemi, M. (2025). Rigorous
explainable artificial intelligence models for predicting CO₂–brine interfacial tension:
Implications for CO₂ sequestration in saline aquifers. Energy Fuels 39, 14237– 14253.
https://doi.org/10.1021/acs.energyfuels.5c00812

Amooie, M. A., Hemmati-Sarapardeh, A., Karan, K., Husein, M. M., Soltanian, M. R., & Dabir,
B. (2019). Data-driven modeling of interfacial tension in impure CO2-brine systems with
implications for geological carbon storage. International Journal of Greenhouse Gas
Control, 90, 102811. https://doi.org/10.1016/j.ijggc.2019.102811

Angelopoulos, A. N., & Bates, S. (2023). Conformal Prediction: A Gentle Introduction.
Foundations and Trends in Machine Learning, 16(4), 494–591.
https://doi.org/10.1561/2200000101


Arif, M., Al-Yaseri, A. Z., Barifcani, A., Lebedev, M., & Iglauer, S. (2016). Impact of pressure
and temperature on CO 2 –brine–mica contact angles and CO 2 –brine interfacial tension:
Implications for carbon geo-sequestration. Journal of Colloid and Interface Science, 462,
208 – 215. https://doi.org/10.1016/j.jcis.2015.09.076

Bachu, S., & Bennion, D. B. (200 9 ). Interfacial Tension between CO2, Freshwater, and Brine in
the Range of Pressure from (2 to 27) MPa, Temperature from (20 to 125) °C, and Water
Salinity from (0 to 334 000) mg·L-^1. Journal of Chemical Engineering Data, 54(3), 765–775.
https://doi.org/10.1021/je800529x

Bashir, A., Ali, M., Patil, S., Aljawad, M. S., Mahmoud, M., Al-Shehri, D., Hoteit, H., & Kamal,
M. S. (2024). Comprehensive review of CO2 geological storage: Exploring principles,
mechanisms, and prospects. Earth-Science Reviews, 249, 104672.
https://doi.org/10.1016/j.earscirev.2023.104672

Bikkina, P. K., Shoham, O., & Uppaluri, R. (2011). Equilibrated Interfacial Tension Data of the
CO 2 – Water System at High Pressures and Moderate Temperatures. Journal of Chemical
Engineering Data, 56(10), 3725–3733. https://doi.org/10.1021/je200302h

Chalbaud, C., Robin, M., Lombard, J.-M., Martin, F., Egermann, P., & Bertin, H. (2009).
Interfacial tension measurements and wettability evaluation for geological CO2 storage.
Advances in Water Resources, 32(1), 98 – 109.
https://doi.org/10.1016/j.advwatres.2008.10.012

Chen, W.-Y., Sun, L., Zhou, J., Li, X., Huang, L., Xia, G., Meng, X., & Wang, K. (2024). Toward
predicting interfacial tension of impure and pure CO₂–brine systems using robust correlative
approaches. ACS Omega, 9(7), 7937–7957. https://doi.org/10.1021/acsomega.3c07956

Chiquet, P., Daridon, J.-L., Broseta, D., & Thibeau, S. (2007). CO2/water interfacial tensions
under pressure and temperature conditions of CO2 geological storage. Energy Conversion
and Management, 48(3), 736–744. https://doi.org/10.1016/j.enconman.2006.09.011

Chow, Y. T. F., Maitland, G. C., & Trusler, J. P. M. (2016). Interfacial tensions of the (CO2+
N2+ H2O) system at temperatures of (298 to 448) K and pressures up to 40 MPa. The Journal
of Chemical Thermodynamics, 93, 392–403. https://doi.org/10.1016/j.jct.2015.08.006

Davari, M.A., & Bigdeli, A. (2025). Machine learning insights into CO₂-brine interfacial
tension: Effects of salt type, concentration, and temperature. J. Pet. Explor. Prod. Technol.
15, 179. https://doi.org/10.1007/s13202- 025 - 01875 - 8

Dehaghani, A. H. S., & Soleimani, R. (2019). Estimation of Interfacial Tension for Geological
CO 2 Storage. Chemical Engineering Technology, 42(3), 680–689. Portico.
https://doi.org/10.1002/ceat.201700700

Friedman, J. H. (1991). Multivariate Adaptive Regression Splines. The Annals of Statistics,
19(1). https://doi.org/10.1214/aos/1176347963


Georgiadis, A., Maitland, G., Trusler, J. P. M., & Bismarck, A. (2010). Interfacial Tension
Measurements of the (H 2 O + CO 2 ) System at Elevated Pressures and Temperatures. Journal
of Chemical Engineering Data, 55(10), 4168–4175. https://doi.org/10.1021/je100198g

Hebach, A., Oberhof, A., Dahmen, N., Kögel, A., Ederer, H., & Dinjus, E. (2002). Interfacial
Tension at Elevated PressuresMeasurements and Correlations in the Water + Carbon
Dioxide System. Journal of Chemical Engineering Data, 47(6), 1540–1546.
https://doi.org/10.1021/je025569p

Hosseini, A.M., Ghadery-Fahliyany, H., Wood, D.A., & Choubineh, A. (2020). Artificial
intelligence-based modeling of interfacial tension for carbon dioxide storage. Gas Process.
J. 8, 83–92. https://doi.org/10.22108/gpj.2020.119977.1069

Iglauer, S., Mathew, M. S., & Bresme, F. (2012). Molecular dynamics computations of brine–
CO2 interfacial tensions and brine–CO2–quartz contact angles and their effects on
structural and residual trapping mechanisms in carbon geo-sequestration. Journal of
Colloid and Interface Science, 386(1), 405–414. https://doi.org/10.1016/j.jcis.2012.06.052

International Energy Agency (2025). Global Energy Review 2025: CO₂ Emissions. IEA, Paris.
https://www.iea.org/reports/global-energy-review-co2-emissions-in- 2024

Ivakhnenko, A.G. (1968). The group method of data handling - a rival of the method of
stochastic approximation. Soviet Autom. Control 13, 43–55.

Jerauld, G. R., & Kazemi, A. (2022). An improved simple correlation for accurate estimation
of CO2-Brine interfacial tension at reservoir conditions. Journal of Petroleum Science and
Engineering, 208, 109537. https://doi.org/10.1016/j.petrol.2021.109537

Kamari, A., Pournik, M., Rostami, A., Amirlatifi, A., & Mohammadi, A. H. (2017).
Characterizing the CO2-brine interfacial tension (IFT) using robust modeling approaches: A
comparative study. Journal of Molecular Liquids, 246, 32–38.
https://doi.org/10.1016/j.molliq.2017.09.010

Kay, W. (1936). Gases and Vapors at High Temperature and Pressure - Density of
Hydrocarbon. Industrial Engineering Chemistry, 28(9), 1014 – 1019.
https://doi.org/10.1021/ie50321a008

Khan, M.R., Tariq, Z., Ali, M., & Murtaza, M. (2024). Predicting interfacial tension in CO₂/brine
systems: A data-driven approach and its implications for carbon geostorage. Paper IPTC-
23568 - MS presented at the International Petroleum Technology Conference, Dhahran,
Saudi Arabia, 12–14 February 2024. https://doi.org/10.2523/IPTC- 23568 - MS

Kvamme, B., Kuznetsova, T., Hebach, A., Oberhof, A., & Lunde, E. (2007). Measurements
and modelling of interfacial tension for water + carbon dioxide systems at elevated
pressures. Computational Materials Science, 38(3), 506 – 513.
https://doi.org/10.1016/j.commatsci.2006.01.020

Li, X., Boek, E., Maitland, G.C., Trusler, J.P.M., 2012. Interfacial tension of (brines + CO₂):
(0.864 NaCl + 0.136 KCl) at temperatures between (298 and 448) K, pressures between (2


and 50) MPa, and total molalities of (1 to 5) mol·kg⁻¹. J. Chem. Eng. Data 57, 1078–1088.
https://doi.org/10.1021/je201062r

Li, J.-Q., Bian, X.-Q., Chen, J., Liu, Y.-B., & Matthews, A. (2024). Improved neural network
model based on dung beetle algorithm to predict CO2-brine interfacial tension. Geoenergy
Science and Engineering, 239, 212957. https://doi.org/10.1016/j.geoen.2024.212957

Li, Z., Wang, S., Li, S., Liu, W., Li, B., & Lv, Q.-C. (2013). Accurate Determination of the CO 2 –
Brine Interfacial Tension Using Graphical Alternating Conditional Expectation. Energy &
Fuels, 28(1), 624–635. https://doi.org/10.1021/ef401815q

Liaqat, K., Preston, D. J., & Schaefer, L. (2025). Predicting the interfacial tension of CO2 and
NaCl aqueous solution with machine learning. Scientific Reports, 15(1).
https://doi.org/10.1038/s41598- 025 - 10274 - w

Liu, X., Mutailipu, M., Zhao, J., & Liu, Y. (2021). Comparative analysis of four neural network
models on the estimation of CO₂–brine interfacial tension. ACS Omega 6, 4282–4288.
https://doi.org/10.1021/acsomega.0c05271

Liu, Y., Li, H., & Okuno, R. (2016). Measurements and modeling of interfacial tension for
CO₂/CH₄/brine systems under reservoir conditions. Ind. Eng. Chem. Res. 55, 12358–12375.
https://doi.org/10.1021/acs.iecr.6b02700

Liu, Y., Tang, J., Wang, M., Wang, Q., Tong, J., Zhao, J., & Song, Y. (2017). Measurement of
interfacial tension of CO₂ and NaCl aqueous solution over wide temperature, pressure, and
salinity ranges. J. Chem. Eng. Data 62, 1036 – 1046.
https://doi.org/10.1021/acs.jced.6b00896

Macleod, D. B. (1923). On a relation between surface tension and density. Transactions of
the Faraday Society, 19(July), 38. https://doi.org/10.1039/tf9231900038

Mouallem, J., Arif, M., Raza, A., Glatz, G., Rahman, M. M., Mahmoud, M., & Iglauer, S. (2024).
Critical review and meta-analysis of the interfacial tension of CO2-brine and H2-brine
systems: Implications for CO2 and H2 geo-storage. Fuel, 356, 129575.
https://doi.org/10.1016/j.fuel.2023.129575

Mouallem, J., Raza, A., Glatz, G., Mahmoud, M., & Arif, M. (2024). Estimation of CO2-Brine
interfacial tension using Machine Learning: Implications for CO2 geo-storage. Journal of
Molecular Liquids, 393, 123672. https://doi.org/10.1016/j.molliq.2023.123672

Mutailipu, M., Liu, Y., Jiang, L., & Zhang, Y. (2019). Measurement and estimation of CO2–
brine interfacial tension and rock wettability under CO2 sub- and super-critical conditions.
Journal of Colloid and Interface Science, 534, 605 – 617.
https://doi.org/10.1016/j.jcis.2018.09.031

Mutailipu, M., Yang, Y., Zuo, K., Xue, Q., Wang, Q., Xue, F., & Wang, G. (2024). Estimation of
CO₂-brine interfacial tension based on an advanced intelligent algorithm model: Application
for carbon saline aquifer sequestration. ACS Omega 9, 37265–37277.
https://doi.org/10.1021/acsomega.4c04623


Nielsen, L. C., Bourg, I. C., & Sposito, G. (2012). Predicting CO2–water interfacial tension
under pressure and temperature conditions of geologic CO2 storage. Geochimica et
Cosmochimica Acta, 81, 28–38. https://doi.org/10.1016/j.gca.2011.12.018

Niroomand-Toomaj, E., Etemadi, A., & Shokrollahi, A. (2017). Radial basis function modeling
approach to prognosticate the interfacial tension CO 2 /Aquifer Brine. Journal of Molecular
Liquids, 238, 540–544. https://doi.org/10.1016/j.molliq.2017.04.135

[dataset] Olagunju, D.T., Agwu, O.E., Md Yusof, M.A., ( 2026 ). Supplementary Data and Code
for: Closed-Form MARS Equations with Calibrated Conformal Uncertainty for CO₂–Brine
Interfacial Tension Prediction. Zenodo. https://doi.org/10.5281/zenodo.20242554

Turkson, J.N., Md Yusof, M.A., Fjelde, I., Sokama-Neuyam, Y.A., Darkwah-Owusu, V., &
Tackie-Otoo, B.N. (2024). Harnessing ensemble learning techniques for accurate interfacial
tension estimation in aqueous CO₂ systems. Paper SPE- 219176 - MS presented at the SPE
GOTECH conference, Dubai, UAE, 7–9 May 2024. https://doi.org/10.2118/219176-MS

Okon, J., Udoh, T., & Emenka, B. (2024). Prediction of interfacial tension using machine
learning: A review of applied techniques in petrochemical/reservoir engineering. IRE
Journals, 7(9), 220–233. https://www.irejournals.com/formatedpaper/1705605.pdf

Partovi, M., Mosalanezhad, M., Lotfi, S., Barati-Harooni, A., Najafi-Marghmaleki, A., &
Mohammadi, A. H. (2017). On the estimation of CO2-brine interfacial tension. Journal of
Molecular Liquids, 243, 265–272. https://doi.org/10.1016/j.molliq.2017.08.027

Pereira, L. M. C., Chapoy, A., Burgass, R., & Tohidi, B. (2017). Interfacial tension of CO2+
brine systems: Experiments and predictive modelling. Advances in Water Resources, 103,
64 – 75. https://doi.org/10.1016/j.advwatres.2017.02.015

Rashid, S., Harimi, B., & Hamidpour, E. (2017). Prediction of CO 2 -Brine interfacial tension
using a rigorous approach. Journal of Natural Gas Science and Engineering, 45, 108–117.
https://doi.org/10.1016/j.jngse.2017.05.002

Ren, Q.-Y., Chen, G.-J., Yan, W., & Guo, T.-M. (2000). Interfacial Tension of (CO 2 + CH 4 ) +
Water from 298 K to 373 K and Pressures up to 30 MPa. Journal of Chemical Engineering
Data, 45(4), 610–612. https://doi.org/10.1021/je990301s

Safaei-Farouji, M., Vo Thanh, H., Sheini Dashtgoli, D., Yasin, Q., Radwan, A. E., Ashraf, U., &
Lee, K.-K. (2022). Application of robust intelligent schemes for accurate modelling
interfacial tension of CO2 brine systems: Implications for structural CO2 trapping. Fuel,
319, 123821. https://doi.org/10.1016/j.fuel.2022.123821

Salehi, N., Kazemi, M., Esmaeilbeig, M. A., Helalizadeh, A., & Bahari Moghaddam, M. (2025).
Experimental and Molecular Dynamics Simulation of Interfacial Tension Measurements in
CO2–Brine/Oil Systems: A Literature Review. Gases, 5(4), 23.
https://doi.org/10.3390/gases5040023


Saud Ul Hassan, M., Liaqat, K., & Schaefer, L. (2025). A comprehensive review of
characterizing CO 2 - brine interfacial tension in saline aquifers using machine learning.
Environmental Science: Advances, 4(12), 1963–1986. https://doi.org/10.1039/d5va00163c

Shen, B., Yang, S., Hu, J., Gao, Y., Xu, H., Gao, X., & Chen, H. (2024). Application of
heterogeneous ensemble learning for CO₂–brine interfacial tension prediction: Implications
for CO₂ storage. Energy Fuels 38, 4401 – 4416.
https://doi.org/10.1021/acs.energyfuels.3c04414

Song, T., Zhu, W., Emami-Meybodi, H., Jiang, Y., Chen, S., Yue, M., Mahani, H., Liao, Q.,
Iglauer, S., & Pan, B. (2026). An explicit machine learning model for brine-gas interfacial
tension prediction: Implications for H2, CH4, and CO2 geo-storage. Fuel, 405, 136502.
https://doi.org/10.1016/j.fuel.2025.136502

Sugden, S. (1924). CXLII. A relation between surface tension, density, and chemical
composition. J. Chem. Soc., Trans., 125(0), 1177 – 1189.
https://doi.org/10.1039/ct9242501177

Turkson, J. N., Md Yusof, M. A., Olutoki, J. O., Tackie-Otoo, B. N., Adenutsi, C. D., Fjelde, I.,
Sokama-Neuyam, Y. A., & Darkwah-Owusu, V. (2026). Integrating nature-inspired
optimization techniques and machine learning for accurate CO2/brine interfacial tension
estimation: Implications for CO2 sequestration and uncertainty analysis. Gas Science and
Engineering, 145, 205796. https://doi.org/10.1016/j.jgsce.2025.205796

Vakili-Nezhaad, G. R., Al Shaaili, A., Yousefzadeh, R., Kazemi, A., & Al Ajmi, A. (2024). CO2-
brine interfacial tension correlation based on the classical orthogonal polynomials:
monovalent salts with common anion. Chemical Papers, 78(6), 3483–3493.
https://doi.org/10.1007/s11696- 024 - 03321 - 9

Vakili-Nezhaad, G. R., Yousefzadeh, R., Kazemi, A., Al-Ajmi, A., Al Shaaili, A., & Rahimi-Ahar,
Z. (2025). Estimating the interfacial tension of CO 2 and brine solutions containing Na 2 SO 4
using group method of data handling. Chemical Engineering Communications, 213(1), 42–

56. https://doi.org/10.1080/00986445.2025.2521350

Vakili-Nezhaad, G. R., Yousefzadeh, R., Kazemi, A., Shaaili, A. A., & Al Ajmi, A. (2024).
Application of deep learning through group method of data handling for interfacial tension
prediction in brine/CO2 systems: MgCl2 and CaCl2 aqueous solutions. International Journal
of Greenhouse Gas Control, 135, 104147. https://doi.org/10.1016/j.ijggc.2024.104147

Vovk, V., Gammerman, A., & Shafer, G. (2005). Algorithmic Learning in a Random World.
Springer, New York.

Xie, M., Zhang, M., & Jin, Z. (2024). Machine learning-based interfacial tension equations for
(H₂ + CO₂)-water/brine systems over a wide range of temperature and pressure. Langmuir
40, 5369–5377. https://doi.org/10.1021/acs.langmuir.3c03785


Yan, W., Zhao, G.-Y., Chen, G.-J., & Guo, T.-M. (2001). Interfacial Tension of (Methane +
Nitrogen) + Water and (Carbon Dioxide + Nitrogen) + Water Systems. Journal of Chemical
Engineering Data, 46(6), 1544–1548. https://doi.org/10.1021/je0101505

Yekeen, N., Padmanabhan, E., Abdulelah, H., Irfan, S. A., Okunade, O. A., Khan, J. A., &
Negash, B. M. (2021). CO2/brine interfacial tension and rock wettability at reservoir
conditions: A critical review of previous studies and case study of black shale from
Malaysian formation. Journal of Petroleum Science and Engineering, 196, 107673.
https://doi.org/10.1016/j.petrol.2020.107673

Zhang, C., & Wang, M. (2023). CO2/brine interfacial tension for geological CO2 storage: A
systematic review. Journal of Petroleum Science and Engineering, 220, 111154.
https://doi.org/10.1016/j.petrol.2022.111154

Zhang, J., Feng, Q., & Zhang, X. (2020a). The use of machine learning methods for fast
estimation of CO₂-brine interfacial tension: A comparative study, in: Proceedings of the
2020 5th International Conference on Machine Learning Technologies. pp. 1–5.
https://doi.org/10.1145/3409073.3409109

Zhang, J., Feng, Q., Zhang, X., Shu, C., Wang, S., & Wu, K. (2020b). A supervised learning
approach for accurate modeling of CO₂–brine interfacial tension with application in
identifying the optimum sequestration depth in saline aquifers. Energy Fuels 34, 7353 – 7362.
https://doi.org/10.1021/acs.energyfuels.0c00321

**Appendix**

**A1.** Min–Max scaler parameters bounds

```
Feature Symbol Sub 𝑥 567 Sub^
𝑥 589
```
```
Sup 𝑥 567 Sup^
𝑥 589
```
```
Unit
```
```
Reduced pressure 𝑃#^ 0.01355 4.69460 1.00271 9.41870 dimensionless
```
```
Reduced
temperature
```
𝑇# (^) 0.91495 2.21720 1.01255 2.21720 dimensionles
s
Squared density diff. 𝛥𝜌^2 0.000132 1.29489 0.001681 1.60309 (g/cm^3 )
Monovalent molality MCM 0.0 4.90 0.0 4.95 Mol/kg
Divalent molality BCM 0.0 1.50 0.0 5.00 Mol/kg
CH₄ mole fraction 𝑥^23 "^ 0.0 89.0 0.0 89.0 mol%


**Feature Symbol** (^) **Sub** 𝑥 567 **Sub**^
𝑥 589 **Sup**^ 𝑥^567^
**Sup**
𝑥 589
**Unit**
N₂ mole fraction 𝑥^4 #^ 0.0 76.36 0.0 76.36 mol%
Divalent binary flag BCM_bin 0.0 1.0 0.0 1.0 binary
CH₄ binary flag CH4_bin 0.0 1.0 0.0 1.0 binary
N₂ binary flag N2_bin 0.0 1.0 0.0 1.0 binary


