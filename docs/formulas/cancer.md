# Cancer formulas (group D, issue #69)

Files: `js/engine/formulas/<id>.js`, grouped in `js/engine/formulas/_group-cancer.js` (`formulas`, `checks()`, `fieldLabels`). Shared helpers: `_cancer-util.js`. Numbers come from `js/data/coefficients.js`; each file names the table, page or literature notes it was copied from. Licence notes are kept with the team's literature notes apply: BCRAT is written from the published formulas and tables, no package code is pasted.

New person fields (all `profile.*` unless noted): `ethnicity` ('white' | 'black' | 'hispanic' | 'asian' | 'other'), `packYears`, `cigsPerDay`, `yearsSmoked`, `yearsSinceQuit`, `educationLevel` (1–6), `cancerHistory`, `copd`, `familyLungCancer`, `familyColorectalCancer`, `familyBreastCancerCount` (0 | 1 | 2), `ageAtMenarche`, `ageAtFirstLiveBirth` (number or `'none'`), `breastBiopsyCount`, `atypicalHyperplasia`, `diabetesOnsetAge`, `weightChangeKg12m`, `labs.glucoseChangeMgDl12m`, `labs.psaNgMl`, `dreAbnormal`, `priorNegativeBiopsy`, `familyProstateCancer`.

## PLCOm2012 (`plcom2012`)

- **Outcome**: lung cancer within 6 years, ever-smokers only. Never-smokers: not applicable. Ethnicity `other`: not applicable.
- **Inputs**: age, smoking (former or current), ethnicity, education (`educationLevel` 1–6, or estimated from `educationYears`), height and weight (BMI), COPD, cancer history, family lung cancer, cigarettes per day (or `packYears` ÷ `yearsSmoked` × 20), years smoked, years since quitting (former smokers; current smokers use 0).
- **Equation**: logit = −4.532506 + 0.0778868(age−62) + ethnicity term − 0.0812744(education−4) − 0.0274194(BMI−27) + 0.3553063·COPD + 0.4589971·cancer history + 0.587185·family lung cancer + 0.2597431·current smoker − 1.822606·((cigarettes/10)^−1 − 0.4021541613) + 0.0317321(years smoked−27) − 0.0308572(years since quit−10); risk = 1/(1+e^−logit). Ethnicity terms: White 0, Black 0.3944778, Hispanic −0.7434744, Asian −0.466585.
- **Age range**: 55–74 (PLCO enrolment range; the paper's Table 2 states none, so this is unconfirmed).
- **Source**: Tammemägi 2013, N Engl J Med 368:728–736, Table 2.
- **Checks**: two self-computed examples from the team's literature notes (0.008917 and 0.081883); the paper prints no numeric example.

## APCS (`apcs`)

- **Outcome**: share of people with advanced colorectal neoplasia on a first colonoscopy (prevalence, not future risk). Shown value = share in the validation group's tier: 0–1 points 1.3%, 2–3 points 3.2%, 4–7 points 5.2%.
- **Inputs**: age, sex, `familyColorectalCancer`, smoking (former or current counts as ever).
- **Equation**: age (under 50: 0, 50–69: 2, 70+: 3) + man 1 + family history 2 + ever smoked 1.
- **Age range**: none stated by the paper.
- **Source**: Yeoh 2011, Gut 60:1236–1241, Tables 5 and 7. `derivedIn` is `'ASIA'` (outside the documented `US | TW | EU`).
- **Checks**: tier shares recomputed from the Table 7 counts (7/559, 31/966, 19/367); two score boundaries.

## END-PAC (`end-pac`)

- **Outcome**: pancreatic cancer within 3 years of new-onset diabetes. `kind: 'score'`.
- **Gate**: age 50 or over, `diabetes` true, diagnosed no more than 1 year ago (`age − diabetesOnsetAge`), glucose at diagnosis 126 or higher, glucose a year earlier below 126.
- **Inputs**: `diabetesOnsetAge`, `weightChangeKg12m`, `labs.fastingGlucoseMgDl` (at diagnosis), `labs.glucoseChangeMgDl12m` (glucose a year earlier = glucose now − change).
- **Equation**: glucose-change points (category at diagnosis − category a year earlier, 1–4) + weight points (≤ −6 kg: +6 … ≥ +6 kg: −6) + age points (≤59: −1, 60–69: 0, ≥70: +1). 3 or more = high group (3.6% had cancer in validation), 1–2 intermediate (0.54%), 0 or less low (none).
- **Source**: Sharma 2018, Gastroenterology 155:730–739, Table 1. The glucose-change rule is an inference (see notes in the file).
- **Checks**: three self-computed examples from the team's literature notes (8, 0, 3 points).

## PCPT Risk Calculator 2.0 (`pcpt-rc-2-0`)

- **Outcome**: chance a biopsy done now finds no cancer, low-grade or high-grade cancer; value = high-grade. Men only.
- **Inputs**: age, `labs.psaNgMl`, ethnicity (`black` = African American), optional `priorNegativeBiopsy`, `dreAbnormal`, `familyProstateCancer` (the matching smaller published model is used when one is not answered).
- **Equation**: S1 and S2 are linear in log2(PSA), age, African American and the optional terms; none = 1/(1+e^S1+e^S2), low = e^S1/(…), high = 1 − none − low.
- **Age range**: none stated.
- **Source**: Ankerst 2014, Urology, authors' supplementary R file (read, never run). %free PSA, PCA3, T2:ERG, detailed family history and SNP updates are not implemented.
- **Checks**: two self-computed examples (high-grade 0.058996 and 0.371837).

## NCI BCRAT (`nci-bcrat-cran-bcra`)

- **Outcome**: invasive breast cancer within 5 years (10-year risk in the notes). Women, 35–85. White, Black, Other. Hispanic (needs birthplace) and Asian (use AABCS): not applicable.
- **Inputs**: age, ethnicity, `ageAtMenarche`, `ageAtFirstLiveBirth` (number or `'none'`), `familyBreastCancerCount`, `breastBiopsyCount`, `atypicalHyperplasia` (unknown counts as 1.00).
- **Equation**: relative risk = exp(NB·β1 + AM·β2 + AF·β3 + NR·β4 + AF·NR·β6 [+ NB·β5 from age 50]) × hyperplasia factor (1.82, 0.93, 1.00); absolute risk by Gail 1989 equation 6 in one-year steps with incidence and competing-death rates (`bcra-rates.csv`, copied as constants).
- **Source**: Gail 1989; CRAN BCRA 2.1.2 coefficients and rates as recorded in the team's literature notes. The package uses the older White 1983–87 rates; the current NCI tool's table is unconfirmed.
- **Checks**: self-computed White examples W-1 to W-3 from the team's literature notes (14 checks). No official White/Black output has been compared.

## AABCS (`aabcs`)

- **Outcome**: invasive breast cancer within 5 years, Asian American women (ethnicity `asian`), 20–85 (age range unconfirmed). All women with `asian` use the Chinese American rates.
- **Inputs**: as BCRAT. Relatives are 0 or more than 0; no age or birth × relative interaction.
- **Equation**: RR = exp(0.5526·biopsies + 0.0750·AGEMEN + 0.2764·AGEFLB + 0.7919·relative) × hyperplasia factor; F = 0.4752 under 50 and 0.5032 from 50; same absolute-risk algorithm.
- **Source**: Matsuno 2011, J Natl Cancer Inst 103:951–961, Supplementary Tables 1–2.
- **Checks (published)**: worked example, age 30, no births, menarche 14, mother with breast cancer, 1 biopsy: RR 6.67 and 30-year risk 9.90%; four values from Table 2 (7.52, 14.47, 6.79, 8.25).

## Not implemented

- NCI CCRAT (colorectal): not started within the time box.
