# Cardiovascular formulas (group A, issue #69)

All are estimates from published formulas. Not a diagnosis. Not medical advice. Each is exported from `js/engine/formulas/_group-cvd.js` (`formulas`, `checks()`, `fieldLabels`). Every formula returns "not applicable" outside its age range or when `profile.cvdHistory` is true, and lists missing inputs instead of guessing.

New person fields used here: `profile.ethnicity` (`white`, `black`, `hispanic`, `asian`, `other`), `profile.statin` (bool), `profile.region` (string), `profile.urban` (bool), `profile.familyAscvd` (bool), `labs.egfr` (mL/min/1.73 m²). `profile.region` means a risk region for SCORE2-OP (`low`, `moderate`, `high`, `very-high`) and `north` / `south` for China-PAR.

SCORE2 (the 40–69 model) is not included: its coefficients are not in `js/data/coefficients.js` or the research files.

## Pooled Cohort Equations: `pooled-cohort-equations-pce`

- Inputs: age, sex, sbp, bpTreated, smoking, diabetes, labs.totalCholMgDl and labs.hdlMgDl (mg/dL). Optional: profile.ethnicity.
- Equation: risk = 1 − S10^exp(IndividualSum − MeanSum). IndividualSum = Σ coefficient × value, with natural logs of age, cholesterol, HDL and SBP, plus age interactions (Table A). Treated and untreated SBP are separate terms. Four coefficient sets: white women, African American women, white men, African American men.
- Ethnicity `black` uses the African American set, `white` the white set. Missing or any other ethnicity uses the white set and the notes say so (the guideline allows it with a weak recommendation; it was not built for adults in Taiwan).
- Ages 40–79. Outcome: first heart attack, coronary death or stroke within 10 years.
- Source: Goff 2014, Circulation 129(25 Suppl 2):S49–S73, Table A. doi 10.1161/01.cir.0000437741.48606.98.
- Reproduces: Table A example (age 55, TC 213, HDL 50, SBP 120 untreated, non-smoker, no diabetes): 2.1 / 3.0 / 5.3 / 6.1% (white women / African American women / white men / African American men), within 0.1 point. MeanSum is printed to two decimals only.

## AHA PREVENT: `aha-prevent`, `aha-prevent-ascvd`, `aha-prevent-hf`

- Inputs: age, sex, sbp, bpTreated, statin, diabetes, smoking, labs.totalCholMgDl, labs.hdlMgDl, labs.egfr. Heart failure also needs heightCm and weightKg (BMI).
- Equation: risk = e^x / (1 + e^x), x = constant + Σ β·term. Cholesterol is converted to mmol/L (× 0.02586); non-HDL = total − HDL. Terms are centred (age 55, non-HDL 3.5, HDL 1.3, SBP 110 and 130, BMI 25 and 30, eGFR 60 and 90) and include age interactions and statin / blood-pressure-treatment terms. Base model only (no UACR, HbA1c, deprivation index).
- Ages 30–79. Outcome: total CVD, ASCVD, or heart failure within 10 years. eGFR is read, not computed from creatinine.
- Source: Khan 2024, Circulation 149:430–449, Supplemental Table S12A (10-year base). doi 10.1161/CIRCULATIONAHA.123.067626.
- Unconfirmed: the term centring is not in the coefficient CSV; it comes from the team's earlier proof of concept and is confirmed only by the examples below.
- Reproduces: Table S25 (woman 50, TC 200, HDL 45, SBP 160 treated, diabetes, eGFR 90): log-odds −1.75961, total CVD 14.68%. Main-text example (woman 50, TC 240, HDL 55, SBP 160 treated, BMI 35, eGFR 90): total CVD / ASCVD / heart failure 5.4 / 3.6 / 2.5%, and 9.3 / 6.0 / 4.7% if she smokes (within 0.05 point). A man cross-check (16.3 / 10.2 / 10.6%) comes from the preventr package tests, not the paper.

## SCORE2-OP: `score2-op`

- Inputs: age, sex, sbp, smoking, diabetes, labs.totalCholMgDl and labs.hdlMgDl (converted to mmol/L). Optional: profile.region (`low`, `moderate`, `high`, `very-high`); missing or unrecognised means the low-risk region, stated in the notes.
- Equation: LP = Σ β·(x − centre), centres age 73, SBP 150, TC 6, HDL 1.4; raw = 1 − S0^exp(LP − meanLP); risk = 1 − exp(−exp(scale1 + scale2·ln(−ln(1 − raw)))) with the region's scale (Supplementary Methods Table 1). The heart-failure multiplier is not applied.
- Ages 70 and over (no upper limit stated in the research file; unconfirmed). Outcome: fatal or non-fatal CVD within 10 years.
- Source: de Vries 2021, Eur Heart J 42:2455–2467. doi 10.1093/eurheartj/ehab312.
- Reproduces: Supplementary Table 3 example (age 75, smoker, no diabetes, SBP 140, TC 5.5, HDL 1.3): uncalibrated risk 24.42% (women) and 29.66% (men). The paper's calibrated example uses an older scaling than its own Table 1, so the low-region values here (15.2% / 18.6%) are self-computed.

## China-PAR: `china-par`

- Inputs: age, sex, sbp, bpTreated, smoking, diabetes, waistCm, labs.totalCholMgDl and labs.hdlMgDl (mg/dL), profile.region (`north` or `south`). Men also need profile.urban and profile.familyAscvd.
- Equation: risk = 1 − S10^exp(sum − mean sum). Natural logs of age, SBP, TC, HDL and waist; ln(age) × ln(SBP) and, in men, ln(age) × smoker and ln(age) × family history. Coefficients have two decimals.
- Ages 35–74. Outcome: first heart attack or stroke within 10 years. Built on mainland China; not validated in Taiwan.
- Source: Yang 2016, Circulation 134:1430–1440, Online Supplement Tables 1–2. doi 10.1161/CIRCULATIONAHA.116.022367.
- Unconfirmed: S10 was back-calculated (men 0.9724, women 0.985) because the printed values (0.9707 for men, 0.99 for women) do not reproduce the paper's Table 2.
- Reproduces: main-text Table 2 (SBP 130 untreated, TC 210, HDL 55, waist 80, non-smoker, diabetes, north): men aged 40 / 50 / 60 / 70 2.2 / 5.4 / 11.0 / 19.6%; women 2.4 / 5.4 / 10.1 / 17.1%, within 0.1 point (men) and 0.2 point (women).

## Framingham general CVD: `framingham-general-cvd-d-agostino-2008`

- Inputs: age, sex, sbp, bpTreated, smoking, diabetes, labs.totalCholMgDl and labs.hdlMgDl (mg/dL). Former smokers count as non-smokers.
- Equation: risk = 1 − S0^exp(Σ β·x − mean); x = ln(age), ln(TC), ln(HDL), ln(SBP) (separate β for treated and untreated), smoker, diabetes. Women: S0 0.95012, mean 26.1931. Men: S0 0.88936, mean 23.9802.
- Ages 30–74. Outcome: any cardiovascular event (coronary disease, stroke, TIA, peripheral artery disease, heart failure) within 10 years.
- Source: D'Agostino 2008, Circulation 117:743–753 (PMID 18212285); coefficients from the Framingham Heart Study page for this model.
- Unconfirmed: the paper's own worked example was not available, so the checks are regression values computed from the same coefficients (4 people), not examples from the paper. Coefficients were not compared cell by cell with the journal table.
