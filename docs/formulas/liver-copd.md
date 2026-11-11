# Liver and COPD formulas (issue #69, group E)

Code: `js/engine/formulas/<id>.js`, grouped in `_group-liver-copd.js` (`formulas`, `checks()`, `fieldLabels`).
Numbers come from `js/data/coefficients.js` and the research files; FIB-4 has no coefficient table, so its formula and cut-offs come from the research file `risk-models-cancer-copd-liver.md` (section 8.1).
Units are converted inside each formula. Not a diagnosis. Not medical advice.

New input fields: `profile.hbvCarrier`, `hbvTreated`, `hcv`, `cirrhosis`, `chronicLiverDisease` (booleans); `drinksPerWeek` (drinks of 10 g alcohol); `hipCm`; `packYears`; `regularDrinking` (bool); `exerciseMetHoursWeek`; `copdSymptomBreathless`, `copdSymptomPhlegm`, `copdActivityLimited` (option position 0–4, 0 = first printed option); `smoked100Cigarettes` (bool); `copdDiagnosed` (optional bool). Labs: `astUL`, `altUL`, `plateletsK` (10³/µL = 10⁹/L), `albuminGdL`, `bilirubinMgDl`, `ggtUL`, `hbvDnaIuMl`, `hbeagPositive` (bool), `afpNgMl`, `fastingGlucoseMgDl`.

## fib-4 — FIB-4 (kind value)
- Inputs: age, AST, ALT, platelets.
- Equation: age × AST ÷ (platelets × √ALT). Band (Sterling 2006): below 1.45 low, above 3.25 high, between indeterminate. Notes give the fatty-liver cut-offs 1.3 / 2.67 (2.0 over 65).
- Gate: none (no age range stated in the paper).
- Source: Sterling 2006, doi 10.1002/hep.21178.
- Check: hand calculation (50, 40, 25, 200 → 2.0). No example is printed in the paper.

## nafld-fibrosis-score — NAFLD fibrosis score (kind value)
- Inputs: age, height, weight (BMI), AST, ALT, platelets, albumin g/dL, diabetes; fasting glucose only when diabetes is not "yes" (glucose ≥110 counts as 1).
- Equation: −1.675 + 0.037·age + 0.094·BMI + 1.13·(IFG/DM) + 0.99·AST/ALT − 0.013·platelets − 0.66·albumin. Cut-offs −1.455 and 0.676. No probability (the paper gives none).
- Source: Angulo 2007, doi 10.1002/hep.21496, formula PDF p.4.
- Checks: 3 self-computed examples, tolerance 1e-6.

## page-b — PAGE-B (kind score)
- Inputs: age, sex, platelets, `hbvCarrier`, `hbvTreated`.
- Points: age 0–10, male 6, platelets (≥200: 0; 100–199: 6; <100: 9, ×10³/µL). Groups ≤9 / 10–17 / ≥18.
- Gates: age under 16; not a hepatitis B carrier; hepatitis B not on treatment → not applicable.
- Source: Papatheodoridis 2016, Table 3, doi 10.1016/j.jhep.2015.11.035. Fig. 2 5-year % in the notes is digitised from the figure (not printed).
- Checks: 2 self-computed examples (score and group).

## mpage-b — mPAGE-B (kind score)
- Inputs: age, sex, platelets, albumin g/dL, `hbvCarrier`, `hbvTreated`.
- Points: age 0–11, male 2, platelets 0–5, albumin 0–3 (total 0–21). Groups ≤8 / 9–12 / ≥13.
- Gates: as PAGE-B. Unconfirmed: which side the shared interval end-points belong to (assumption in file header).
- Source: Kim 2018, doi 10.1016/j.jhep.2018.07.018.
- Checks: 5 self-computed examples (score and group).

## reach-b — Revised REACH-B (kind risk, 5 years)
- Inputs: age, sex, `hbvCarrier`, `hbvTreated`, `labs.hbeagPositive`, `labs.hbvDnaIuMl`, `labs.altUL`, `labs.plateletsK`.
- Equation: generalised-F survival model; published mu, sigma, Q, P, coefficients and DNA spline; risk = regularised incomplete beta.
- Gates: age outside 30–60 (the range the standardisation was checked in); not a carrier; on treatment; cirrhosis; DNA ≤ 0.
- Derived (not author-published): the covariate standardisation constants, back-calculated from the authors' calculator. Notes warn when ALT, platelets or DNA are outside the checked ranges.
- Source: Kim 2024, doi 10.7326/M24-0384.
- Checks: 11 outputs of the authors' calculator, tolerance 0.01 percentage points. These outputs were also used to fit the constants, so only the female and HBeAg-positive rows are independent.

## amap — aMAP (kind score)
- Inputs: age, sex, bilirubin mg/dL (×17.1 → µmol/L), albumin g/dL (×10 → g/L), platelets; chronic liver disease (`hbvCarrier`, `hcv`, `cirrhosis` or `chronicLiverDisease` true; "no" → not applicable).
- Equation: (0.06·age + 0.89·male + 0.48·ALBI − 0.01·platelets + 7.4) ÷ 14.77 × 100; ALBI = 0.66·log10(bilirubin) − 0.085·albumin. Groups <50 / 50–<60 / ≥60 (boundary side unconfirmed).
- The 5-year risk 1 − 0.984^exp(LP) (LP without 7.4) is a derived candidate, shown in the notes only and labelled so.
- Source: Fan 2020, doi 10.1016/j.jhep.2020.07.025.
- Checks: 3 self-computed examples (score tolerance 1e-4; derived % tolerance 0.01).

## wen-2012 — Wen 2012 Taiwan liver cancer score (kind risk, 10 years)
- Inputs: age, sex, `packYears`, `regularDrinking`, `exerciseMetHoursWeek`, diabetes.
- Model 1 (group without an HCV test): male 2, age 40–59: 2 / 60+: 6, smoking ≥1 pack-year 1, regular drinking 1, activity ≥3.75 MET-h −1, diabetes 2; 5- and 10-year risk from the supplement chart (Supp Figure 2).
- Notes also give A Model 2 (AST, ALT) and B Model 5 (adds AFP, hepatitis B and C) when those inputs exist. A Models 3–4 (image-only charts) and B Models 1–4 are not offered.
- Gate: age under 20.
- Source: Wen 2012, doi 10.1093/jnci/djs372.
- Checks: B Model 5 examples (scores 25 and 0, 5- and 10-year %; scores self-computed, percentages from the chart), A Model 1 example.

## clivd — CLivD (kind risk, 15 years)
- Inputs: age (40–70), sex, waist and hip (WHR), `drinksPerWeek`, diabetes, smoking (current); lab version when `labs.ggtUL` is given.
- Equation: the published linear predictor (supplement p.19–20). Risk groups from LP cut-offs are the published result. The continuous risk 1 − exp(−exp(LP − c)) is derived by the research team, not author-published, and labelled so.
- Source: Åberg 2022, doi 10.1016/j.jhep.2022.02.021.
- Checks: Fig. S16 example (lab LP 2.48236, group intermediate; derived 7.485% vs the paper's about 6%); same inputs without GGT (LP 2.5419).

## copd-ps — COPD-PS (kind score)
- Inputs: age, `copdSymptomBreathless`, `copdSymptomPhlegm`, `copdActivityLimited`, `smoked100Cigarettes`.
- Points (Table 4): breathless 0,0,1,2,2; phlegm 0,0,1,1,2; less active 0,0,0,1,2; smoked 100 cigarettes 2; age 35–49: 0, 50–59: 1, 60+: 2. Cut-off 5 or more (the paper suggests 5–6; Table 6 values in the notes).
- Gates: age under 35; `copdDiagnosed` true.
- Source: Martinez 2008, doi 10.1080/15412550801940721.
- Checks: 2 self-computed examples.
