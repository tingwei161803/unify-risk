# Metabolic and kidney formulas (group B)

Files: `js/engine/formulas/<id>.js`, collected in `js/engine/formulas/_group-metabolic.js` (`formulas`, `checks()`, `fieldLabels`). All numbers are copied from `js/data/coefficients.js` (research files in `docs/research/disease-risk/coefficients/`). Each formula lists what is missing, and returns "not applicable" outside its range or gates. Not a diagnosis. Not medical advice.

New person fields used here (profile unless prefixed `labs.`): `ethnicity` ('white' | 'black' | 'hispanic' | 'asian' | 'other'), `statin` (bool), `strokeHistory` (bool), `ckdStage` (1–5), `heavyDrinking` (bool, drinks 6 or more days a week), `parentsHypertension` (0, 1 or 2 parents), `labs.hba1cPct`, `labs.egfr` (mL/min/1.73 m²), `labs.uacrMgG`, `labs.uricAcidMgDl`, `labs.wbcK` (10³/µL), `labs.postprandialGlucoseMgDl`, `labs.proteinuria` (bool, dipstick 100 mg/dL or more). `labs.creatinineMgDl`, `profile.hypertensionDiagnosed` are labelled but not used by any formula in this group.

Skipped: **CKD-PC incident CKD** (Nelson 2019, id `ckd-pc-ckd`). Its equation is in eTable 8 of the supplement, which is not in `coefficients.js` or the research folder.

## Chin-Shan diabetes score (`chin-shan-diabetes-chien-2008`)

- Source: Chien K, et al. Diabetologia 2009;52:443–450, doi 10.1007/s00125-008-1232-4. Tables 2 and 3.
- Inputs: age, height, weight, `labs.wbcK`, `labs.tgMgDl`, `labs.hdlMgDl`, `labs.fastingGlucoseMgDl`. mg/dL converted to mmol/L with TG × 0.0113, HDL × 0.0259, glucose × 0.0555 (Wilson 2007 factors; not in this paper).
- Equation: score = points for age, BMI, white blood cells, TG, HDL, glucose (−15 to 32); 10-year risk = value printed in Table 3. The paper does not print S0(10).
- Gates: age 35 or over; known diabetes is not applicable. Category edges that touch or overlap: lower edge included (unconfirmed).
- Reproduces: no worked example in the paper. Checked against the printed tables: 8 points → 26%; −15 → 5%; 32 → 86%.

## QDiabetes-2018 models A, B, C (`qdiabetes-2018`, `qdiabetes-2018-b`, `qdiabetes-2018-c`)

- Source: Hippisley-Cox J, Coupland C. BMJ 2017;359:j5019, doi 10.1136/bmj.j5019. Coefficients, centring values and S0 from the CRAN archive QDiabetes_1.0-2.
- Inputs (A): age, sex, ethnicity, smoking, height, weight, familyDiabetes, bpTreated, cvdHistory, statin. B adds `labs.fastingGlucoseMgDl` (× 0.0555 to mmol/L, model range 2 to under 7). C adds `labs.hba1cPct` (to mmol/mol with (% − 2.15) × 10.929, model range 15 to under 48).
- Equation: risk = 1 − S0^exp(score); score = ethnicity + smoking + Σ β·(fractional-polynomial term − centre) + β·(Townsend − centre) + binary terms + age interactions; separate sets for women and men.
- Gates: age 25–84; known diabetes is not applicable; BMI clamped to 20–40.
- Assumptions (shown in notes): Townsend = 0 (no Taiwan equivalent; UK centres are 0.39 women, 0.52 men); ethnicity white → reference, black → BlackCaribbean, asian → Chinese, hispanic/other → Other; current smoker → moderate; family history = parent or sibling; antipsychotics, steroids, learning difficulty, severe mental illness, gestational diabetes, PCOS assumed absent.
- Reproduces: eight self-computed examples from the research file (tolerance 1e-6) and the paper's statin hazard ratios for men in model B at ages 35/45/55/65 (2.41/1.66/1.30/1.15).

## Framingham hypertension (`framingham-hypertension-parikh-2008`)

- Source: Parikh NI, et al. Ann Intern Med 2008;148:102–110, doi 10.7326/0003-4819-148-2-200801150-00005. Table 2, Appendix, Figure 2.
- Inputs: age, sex, sbp, dbp, smoking, `parentsHypertension` (0–2), height, weight.
- Equation: 4-year risk = 1 − exp(−exp((ln 4 − μ)/0.87692)); μ = 22.94954 − 0.15641·age − 0.20293·female − 0.05933·SBP − 0.12847·DBP − 0.19073·smoker − 0.16612·parents − 0.03388·BMI + 0.001624·age·DBP. Figure 2 points (and their 4-year risk) are shown in notes.
- Unconfirmed: Table 2 prints the age × DBP coefficient as 0.00162; 0.001624 is back-calculated from the paper's two examples and is not a published value.
- Gates: age 20–69; known diabetes, treated blood pressure, or BP 140/90 or more are not applicable. Built on white adults.
- Reproduces: Appendix examples: woman 60 → 57.50% (formula) and 23 points → 56.66%; non-smoker variant 19 points → 34.63%; man 50 → 14.89% and 14 points → 16.68% (formula tolerance 0.0001).

## Otsuka 2015, Japanese men (`otsuka-2015`)

- Source: Otsuka T, et al. Hypertens Res 2015;38:419–425, doi 10.1038/hr.2014.159. Table 2, Appendix, Figure 2.
- Inputs: age, sex, height, weight, sbp, dbp, smoking, `heavyDrinking`, `parentsHypertension` (at least one parent counts).
- Equation: 4-year risk = 1 − 0.963^exp(Σβx − 17.119); Σβx = 0.04·age + 0.071·BMI + 0.061·SBP + 0.096·DBP + 0.242·smoker + 0.202·heavy drinking + 0.282·parent. Figure 2 points and risk band in notes.
- Gates: men only; age 19–63; treated BP or BP 140/90 or more, or heart disease, are not applicable.
- Reproduces: Appendix case 1 (Σβx 17.938 → 0.082; 9 points → 5% to under 10%) and case 2 (20.425 → 0.642; 24 points → 50% to under 60%).

## Chien 2010 NTUH CKD (`chien-2010-ckd`, `chien-2010-ckd-lab`)

- Source: Chien KL, et al. Am J Med 2010;123:836–846 (no DOI recorded in the research file). Tables 3 and 4, PDF p.6. Shared helpers in `chien-2010-ckd-core.js`.
- Clinical inputs: age, height, weight, dbp, diabetes, `strokeHistory`. Lab version: age, dbp, `strokeHistory`, `labs.uricAcidMgDl`, `labs.postprandialGlucoseMgDl`, `labs.hba1cPct`, `labs.proteinuria`.
- Equation: points per item; 4-year risk = value printed for the total (clinical 0–17, lab 0–23). S0(4) is not printed.
- Gates: existing CKD (`ckdStage` given, or eGFR below 60) is not applicable. No age range in the paper. DBP 80 or more scores 2 in the clinical table and 1 in the lab table.
- Reproduces: no worked example in the paper. Checked against the printed tables: clinical 9 points → 23%; lab 10 points → 25%.

## KFRE, 4 variables (`kfre`)

- Source: Tangri N, et al. JAMA 2016;315:164–174, doi 10.1001/jama.2015.18202. eAppendix 2 (supplement pp.9–10); checked against the official calculator code.
- Inputs: age, sex, `labs.egfr`, `labs.uacrMgG`; gate by `ckdStage` 3–5 (or eGFR below 60 when no stage is given).
- Equation: risk(t) = 1 − S(t)^exp(−0.2201·(age/10 − 7.036) + 0.2467·(male − 0.5642) − 0.5567·(eGFR/5 − 7.222) + 0.451·(ln ACR − 5.137)); S(5) = 0.924, S(2) = 0.975 (original baseline, the website's "North America" option). Non-North-America calibrated values (S(5) = 0.9365, S(2) = 0.9832) are shown in notes.
- Gates: people without known CKD stage 3–5 are not applicable.
- Reproduces: official calculator outputs for four people (for example man 50, eGFR 30, ACR 50 → 14.49% at 5 years original, 12.18% non-North-America; tolerance 0.0002).
