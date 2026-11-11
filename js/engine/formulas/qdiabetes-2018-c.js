// QDiabetes-2018 (model C, HbA1c): 10-year risk of type 2 diabetes, QDiabetes-2018 C.
// Same equation, population, assumptions and sources as qdiabetes-2018.js (model A); this model adds HbA1c (15 to under 48 mmol/mol).
// Coefficients, centring values and S0: CRAN archive QDiabetes_1.0-2 (R/QDR2018C.R), recorded in our notes
// file coefficients/qdiabetes-2018-2.json. Hippisley-Cox J, Coupland C. BMJ 2017;359:j5019.

import { makeQdiabetes } from './qdiabetes-2018.js';

// Model C: [beta] or [beta, centring value] per term; S0 = 10-year baseline survival.
// Source: BMJ 2017;359:j5019 via the CRAN archive QDiabetes_1.0-2 (R/QDR2018C.R); literature notes coefficients/qdiabetes-2018-2.json.
const COEF = {
  female: {
    S0: 0.988788545131683,
    terms: {
      "eth_Indian": [0.599095159929154],
      "eth_Pakistani": [0.7832030965635389],
      "eth_Bangladeshi": [1.1947351247960103],
      "eth_OtherAsian": [0.7141744699168143],
      "eth_BlackCaribbean": [0.11953284683887688],
      "eth_BlackAfrican": [0.013668872878490427],
      "eth_Chinese": [0.5709226537693946],
      "eth_Other": [0.17091076281069292],
      "smoke_Ex": [0.06584825851000067],
      "smoke_Light": [0.1458413689734224],
      "smoke_Moderate": [0.15258642474801187],
      "smoke_Heavy": [0.30787416796613976],
      "age_1": [3.565521489194772, 2.123332023620606],
      "age_2": [-0.0056158243572733135, 91.64474487304688],
      "bmi_1": [2.504302887454484, 2.571253299713135],
      "bmi_2": [-0.04287580189269046, 16.999439239501953],
      "hba1c_1": [8.736803130736218, 1.886751174926758],
      "hba1c_2": [-0.07823138666994997, 3.559829950332642],
      "tds": [0.035866822056348294, 0.391116052865982],
      "apsy": [0.54976333110422],
      "ster": [0.16872205506389704],
      "cvd": [0.16443300362739344],
      "gdm": [1.125009810517114],
      "learn": [0.2891205831073966],
      "psy": [0.31825122490684077],
      "pcos": [0.33806444140981745],
      "stat": [0.45593968473811164],
      "htn": [0.4040022295023758],
      "fhdm": [0.4428015404826032],
      "age_1*apsy": [-0.8125434197162131],
      "age_2*apsy": [0.0004665611306005428],
      "age_1*learn": [-0.9084665765269808],
      "age_2*learn": [0.0008518980139928006],
      "age_1*stat": [-1.8557960585560658],
      "age_2*stat": [0.0022627250963352537],
      "age_1*bmi_1": [0.6023218765235252],
      "age_2*bmi_1": [-0.0043386645663133425],
      "age_1*bmi_2": [-0.03449503839680447],
      "age_2*bmi_2": [0.0001162778561671209],
      "age_1*hba1c_1": [25.441203322736715],
      "age_2*hba1c_1": [-0.05225413558859252],
      "age_1*hba1c_2": [-6.807608042155611],
      "age_2*hba1c_2": [0.014054825906114453],
      "age_1*fhdm": [-0.2727571351506187],
      "age_2*fhdm": [0.0004354519795220775],
    }
  },
  male: {
    S0: 0.981181740760803,
    terms: {
      "eth_Indian": [0.675712070549878],
      "eth_Pakistani": [0.8314732504966346],
      "eth_Bangladeshi": [1.0969133802228563],
      "eth_OtherAsian": [0.7682244636456048],
      "eth_BlackCaribbean": [0.20897529259108502],
      "eth_BlackAfrican": [0.3809159378197058],
      "eth_Chinese": [0.34235836796612695],
      "eth_Other": [0.22046477853433083],
      "smoke_Ex": [0.11592891206878651],
      "smoke_Light": [0.1462418263763327],
      "smoke_Moderate": [0.10781424112493142],
      "smoke_Heavy": [0.19848629163668474],
      "age_1": [4.019343562397803, 1.496392488479614],
      "age_2": [-0.004839644230627824, 89.04817199707031],
      "bmi_1": [0.8182916890534933, 6.817805767059326],
      "bmi_2": [-0.12558808701359642, 17.801923751831055],
      "hba1c_1": [8.051164223885793, 1.900265336036682],
      "hba1c_2": [-0.14652346893914495, 3.611008167266846],
      "tds": [0.025229965184900727, 0.515986680984497],
      "apsy": [0.455415252201733],
      "ster": [0.13816187686823922],
      "cvd": [0.14546988896239518],
      "learn": [0.2596046658040857],
      "psy": [0.28523788490585894],
      "stat": [0.42551951901185525],
      "htn": [0.3316943000645931],
      "fhdm": [0.5661232594368062],
      "age_1*apsy": [-1.0013331909079835],
      "age_2*apsy": [0.00022455973985742407],
      "age_1*learn": [-0.8916465737221593],
      "age_2*learn": [0.0006604436076569648],
      "age_1*stat": [-1.7074561167819817],
      "age_2*stat": [0.0013873509357389619],
      "age_1*bmi_1": [0.45074527472672443],
      "age_2*bmi_1": [-0.0012224736160287865],
      "age_1*bmi_2": [-0.10851859809165601],
      "age_2*bmi_2": [0.0002266731010346126],
      "age_1*hba1c_1": [27.670593827146565],
      "age_2*hba1c_1": [-0.05920145812475433],
      "age_1*hba1c_2": [-7.400613484678543],
      "age_2*hba1c_2": [0.015592089485149988],
      "age_1*fhdm": [-0.6141009388709716],
      "age_2*fhdm": [0.0005060258289477209],
    }
  }
};

export const qdiabetes2018C = makeQdiabetes({
  id: 'qdiabetes-2018-c',
  name: 'QDiabetes-2018 (model C, HbA1c)',
  lab: {
    field: 'labs.hba1cPct', key: 'hba1c', label: 'HbA1c', unit: 'mmol/mol', range: [15, 48],
    toModel: (pct) => (pct - 2.15) * 10.929,
    note: 'HbA1c is converted from % (NGSP) to mmol/mol (IFCC) with (% − 2.15) × 10.929, the standard master equation; the QDiabetes paper does not print it.'
  }
}, COEF);
export const qdiabetes2018CCoef = COEF;
