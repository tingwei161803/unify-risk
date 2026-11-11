# Dementia, stroke and mortality formulas (group C, issue #69)

Files: `js/engine/formulas/<id>.js`, grouped by `js/engine/formulas/_group-brain-mortality.js` (`formulas`, `checks()`, `fieldLabels`).
All numbers are copied from `COEFFICIENTS[model_id]` in `js/data/coefficients.js`. Every result is an estimate from a published formula, not a diagnosis.

## New person fields

| Field | Type | Label |
| --- | --- | --- |
| `profile.strokeHistory` | bool | Ever had a stroke or TIA (already used by FSRP, BDSI) |
| `profile.familyDementia` | bool | Parent had dementia (already in personas) |
| `profile.depression` | bool | Depression (current or past) or takes an antidepressant |
| `profile.hypertensionDiagnosed` | bool | Told by a doctor you have high blood pressure |
| `profile.highCholesterolDiagnosed` | bool | Told by a doctor you have high cholesterol (name chosen here) |
| `profile.cancerHistory`, `lungDisease`, `heartFailure`, `aspirin`, `livesAlone` | bool | |
| `profile.drinksPerWeek` | number | Alcoholic drinks per week |
| `profile.selfRatedHealth` | `excellent`, `verygood`, `good`, `fair`, `poor` | |
| `profile.hospitalizationsLastYear` | number | Overnight hospital stays in the past year |
| `profile.difficultyBathing`, `difficultyManagingMoney`, `difficultyWalkingBlock`, `difficultyPushingObjects` | bool | Lee index items |
| `profile.needsHelpDailyTasks`, `difficultyWalkingQuarterMile` | bool | Schonberg items (names chosen here) |
| `profile.walkingSpeedFast`, `weightChange3kgLastYear` | bool | Fukushima items (names chosen here) |
| `labs.ldlMgDl`, `labs.hdlMgDl` | mg/dL | |
| `labs.apoe4Count` | 0, 1 or 2 | Optional; switches UKBDRS to its APOE version |

`selfRatedHealth` is a choice field that `util.js` does not know, so `schonberg-index` checks it itself.

## ukbdrs — UK Biobank Dementia Risk Score

- Source: Anatürk M, et al. BMJ Ment Health 2023;26:e300719, Table 1. doi 10.1136/bmjment-2023-300719.
- Age 50–73. Outcome: dementia within 14 years.
- Inputs: age, sex, educationYears, familyDementia, diabetes, depression, strokeHistory, hypertensionDiagnosed, highCholesterolDiagnosed, livesAlone; optional labs.apoe4Count.
- Equation: risk = 1 − S0^exp(Σ β·(x − x̄)); S0 = 0.9916195 (0.9945524 with APOE). Age centred at 59.97, education at 13.54, yes/no items not centred. Betas are the 3-decimal Table 1 values.
- Deprivation (Townsend): no Taiwan equivalent, treated as "not most deprived"; stated in notes.
- Reproduces: the authors' Excel calculator defaults (woman 60, 14 years of education, diabetes, depression, hypertension): linear predictor 1.23748 / 1.27107, risk 2.8591895% (no APOE) and 1.92836% (APOE non-carrier), tolerance 0.0001. The paper's text has no worked example.

## walters-drs — Dementia Risk Score (Walters)

- Source: Walters K, et al. BMC Med 2016;14:6, Additional file 1 Appendix B. DOI not in the extracted sources.
- Age 60–79. Outcome: first dementia diagnosis within 5 years.
- Inputs: age, sex, heightCm, weightKg, bpTreated, smoking, drinksPerWeek, depression, aspirin, strokeHistory, afib, diabetes.
- Equation: risk = 1 − 0.9969^exp(P). P uses age, age², BMI and BMI² (centred at 65.608 and 27.501), calendar year (centred at 2003.719), sex, BP medicine, deprivation quintile, smoking, heavy drinking, depression, aspirin, stroke, AF, diabetes. High-precision betas of the supplement (Table 2 is rounded and gives 12.27% for the example).
- Fixed inputs: deprivation quintile 3 and the current year (both in notes; the year term raises the estimate each year).
- Unconfirmed: the heavy-drinking threshold is an assumption (more than 14 drinks a week); the extracted sources do not define it.
- Reproduces: worked example (woman 75, quintile 4, BMI 25, depression, diabetes, 2013): P = 3.7017581, risk 11.8% (we get 11.82%).

## fukushima-is-2024 — Fukushima ischaemic stroke score

- Source: Ma E, et al. J Atheroscler Thromb 2024;31(3):259–272. doi 10.5551/jat.64018.
- Age 40–74; previous stroke makes it not applicable. Outcome: ischaemic stroke within 4 years.
- Inputs: age, sex, sbp, dbp, bpTreated, diabetes, labs.hdlMgDl, labs.ldlMgDl, smoking (current), walkingSpeedFast, weightChange3kgLastYear.
- Equation: score = sum of Fig. 3a points (age 0–17, male 4, BP class 0/3/6/7, diabetes 4, HDL 0/−2/−3, LDL 0/1/2, smoking 3, fast walking −1, weight change 1); risk = average 4-year risk of the score group (below 8: 0.071%, 8–13: 0.197%, 14–17: 0.394%, 18–21: 0.706%, 22 or more: 1.623%). The continuous equation cannot be rebuilt, so this is a group average.
- The maximum by the table is 38; the paper's text says 35.
- Reproduces: no worked example exists. The check re-derives all 18 Fig. 3a points from Table 2 betas (round(β / 0.1469)).

## lee-index — Lee index

- Source: Lee SJ, et al. JAMA 2006;295(7):801–808 (DOI not in the extracted sources).
- Age over 50 (gate: 51 and over). Outcome: death within 4 years; disease `mortality`.
- Inputs: age, sex, heightCm, weightKg, diabetes, cancerHistory, lungDisease, heartFailure, smoking (current), difficultyBathing, difficultyManagingMoney, difficultyWalkingBlock, difficultyPushingObjects.
- Equation: score 0–26 = age (50–59 0, 60–64 1, 65–69 2, 70–74 3, 75–79 4, 80–84 5, 85+ 7) + male 2 + diabetes 1 + cancer 2 + lung 2 + heart failure 2 + BMI under 25 1 + smoker 2 + bathing 2 + money 2 + walking 2 + pushing 1. Risk = validation death rate of the group: 0–5 4%, 6–9 15%, 10–13 42%, 14+ 64%.
- Reproduces: the Box (man 75–79, smoker, heart failure, three difficulties = 16 points, 64%) and the text example (woman 78 → 6–9 group, 15%; the paper says 6 points but Table 3 adds to 7, same group).

## schonberg-index — Schonberg index

- Source: Schonberg MA, et al. J Gen Intern Med 2009;24(10):1115–1122; 9-year rates J Am Geriatr Soc 2011;59(8):1444–1451 (DOI not in the extracted sources).
- Age 65 and over. Outcome: death within 5 years (value) and 9 years (`alsoRisks`, notes); disease `mortality`.
- Inputs: age, sex, smoking, heightCm, weightKg, lungDisease, diabetes, cancerHistory, hospitalizationsLastYear, selfRatedHealth, needsHelpDailyTasks, difficultyWalkingQuarterMile.
- Equation: score 0–31 = age (65–69 0, 70–74 1, 75–79 3, 80–84 5, 85+ 7) + male 3 + smoking (0/1/3) + BMI under 25 2 + lung 2 + diabetes 2 + cancer 2 + hospital stays (0/1/3) + self-rated health (0/1/2) + needs help 2 + walking 3. Risk = death rate of the 2-point group (5-year: 2009 validation cohort; 9-year: 2011 original validation cohort). The development-cohort rate is in the notes.
- Reproduces: woman 80–84 with no other risk = 5 points, 8%; with former smoking, COPD, diabetes, needs help, walking difficulty and fair health = 17 points, 58% development / 55% validation.
