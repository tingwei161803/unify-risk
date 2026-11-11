// QDiabetes-2018 (model B, fasting glucose): 10-year risk of type 2 diabetes, QDiabetes-2018 B.
// Same equation, population, assumptions and sources as qdiabetes-2018.js (model A); this model adds fasting plasma glucose (2 to under 7 mmol/L).
// Coefficients, centring values and S0: CRAN archive QDiabetes_1.0-2 (R/QDR2018B.R), recorded in our notes
// file coefficients/qdiabetes-2018-2.json. Hippisley-Cox J, Coupland C. BMJ 2017;359:j5019.

import { makeQdiabetes } from './qdiabetes-2018.js';

// Model B: [beta] or [beta, centring value] per term; S0 = 10-year baseline survival.
// Source: BMJ 2017;359:j5019 via the CRAN archive QDiabetes_1.0-2 (R/QDR2018B.R); literature notes coefficients/qdiabetes-2018-2.json.
const COEF = {
  female: {
    S0: 0.990905702114105,
    terms: {
      "eth_Indian": [0.9898906127239111],
      "eth_Pakistani": [1.2511504196326508],
      "eth_Bangladeshi": [1.493475756819612],
      "eth_OtherAsian": [0.9673887434565966],
      "eth_BlackCaribbean": [0.4844644519593178],
      "eth_BlackAfrican": [0.47842149553601027],
      "eth_Chinese": [0.7520946270805577],
      "eth_Other": [0.40508807415414244],
      "smoke_Ex": [0.03741563072369632],
      "smoke_Light": [0.22529736725144828],
      "smoke_Moderate": [0.3099736428023663],
      "smoke_Heavy": [0.43619421394964175],
      "age_1": [3.765012950751728, 2.123332023620606],
      "age_2": [-0.005604334343661494, 91.64474487304688],
      "bmi_1": [2.441093503167247, 2.571253299713135],
      "bmi_2": [-0.04215263347990964, 16.999439239501953],
      "fpg_1": [-2.188789194633731, 0.20830936729908],
      "fpg_2": [-69.96084198286603, 0.326781362295151],
      "tds": [0.03580462976631265, 0.391116052865982],
      "apsy": [0.47483785502538534],
      "ster": [0.37679334437547285],
      "cvd": [0.1967261568066525],
      "gdm": [1.0689325033692647],
      "learn": [0.4542293408951035],
      "psy": [0.16161718890842605],
      "pcos": [0.3565365789576717],
      "stat": [0.5809287382718668],
      "htn": [0.2836632020122907],
      "fhdm": [0.45221497662061116],
      "age_1*apsy": [-0.7683591642786523],
      "age_2*apsy": [0.0005194455624413476],
      "age_1*learn": [-0.7983128124297588],
      "age_2*learn": [0.00030283275671618906],
      "age_1*stat": [-1.9033508839833257],
      "age_2*stat": [0.002439711140601871],
      "age_1*bmi_1": [0.4844747602404915],
      "age_2*bmi_1": [-0.004157297668215406],
      "age_1*bmi_2": [-0.031939988307181345],
      "age_2*bmi_2": [0.00011268821942042522],
      "age_1*fpg_1": [2.244290304740435],
      "age_2*fpg_1": [0.019934530853431255],
      "age_1*fpg_2": [13.006838869978303],
      "age_2*fpg_2": [-0.07166771875293067],
      "age_1*fhdm": [-0.30406273740345013],
      "age_2*fhdm": [0.00045236396712023254],
    }
  },
  male: {
    S0: 0.985019445419312,
    terms: {
      "eth_Indian": [1.0081475800686235],
      "eth_Pakistani": [1.3359138425778705],
      "eth_Bangladeshi": [1.4815419524892652],
      "eth_OtherAsian": [1.0384996851820663],
      "eth_BlackCaribbean": [0.5202348070887525],
      "eth_BlackAfrican": [0.8579673418258559],
      "eth_Chinese": [0.6413108960765616],
      "eth_Other": [0.4838340220821505],
      "smoke_Ex": [0.11194757923641625],
      "smoke_Light": [0.31101320954122047],
      "smoke_Moderate": [0.3328898469326042],
      "smoke_Heavy": [0.4257069026941993],
      "age_1": [4.114914330236472, 1.496392488479614],
      "age_2": [-0.004759357666850536, 89.04817199707031],
      "bmi_1": [0.8169361587644297, 6.817805767059326],
      "bmi_2": [-0.12502377403433362, 17.801923751831055],
      "fpg_1": [-54.84178812809711, 0.448028832674026],
      "fpg_2": [-53.11207849848136, 0.71944260597229],
      "tds": [0.025374175519894356, 0.515986680984497],
      "apsy": [0.44179340888895774],
      "ster": [0.3413547348339454],
      "cvd": [0.21589774543727566],
      "learn": [0.40128850275853],
      "psy": [0.21817693913997793],
      "stat": [0.5147657600111735],
      "htn": [0.24672092874070373],
      "fhdm": [0.5749437333987513],
      "age_1*apsy": [-0.9502224313823127],
      "age_2*apsy": [0.00014729720771628743],
      "age_1*learn": [-0.8358370163090045],
      "age_2*learn": [0.0006012919264966409],
      "age_1*stat": [-1.814178691926946],
      "age_2*stat": [0.0016393484911405418],
      "age_1*bmi_1": [0.37484820920783846],
      "age_2*bmi_1": [-0.0010774782221531713],
      "age_1*bmi_2": [-0.09098365795624874],
      "age_2*bmi_2": [0.00019110487304583101],
      "age_1*fpg_1": [21.011730121764334],
      "age_2*fpg_1": [-0.03900460792238353],
      "age_1*fpg_2": [23.824460044746974],
      "age_2*fpg_2": [-0.04112771980589595],
      "age_1*fhdm": [-0.6780647705291666],
      "age_2*fhdm": [0.0006257588248859499],
    }
  }
};

export const qdiabetes2018B = makeQdiabetes({
  id: 'qdiabetes-2018-b',
  name: 'QDiabetes-2018 (model B, fasting glucose)',
  lab: {
    field: 'labs.fastingGlucoseMgDl', key: 'fpg', label: 'Fasting glucose', unit: 'mmol/L', range: [2, 7],
    toModel: (mgdl) => mgdl * 0.0555,
    note: 'Fasting glucose is converted from mg/dL to mmol/L with × 0.0555 (the factor printed in Wilson 2007, not in the QDiabetes paper).'
  }
}, COEF);
export const qdiabetes2018BCoef = COEF;
