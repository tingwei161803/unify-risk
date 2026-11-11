// QDiabetes-2018 model A (no blood test): 10-year risk of type 2 diabetes.
// Hippisley-Cox J, Coupland C. Development and validation of QDiabetes-2018 risk prediction algorithm to
// estimate future risk of type 2 diabetes: cohort study. BMJ 2017;359:j5019. England, QResearch, ages 25-84,
// no diabetes at baseline. Coefficients, centring values and S0 come from the CRAN archive QDiabetes_1.0-2
// (R/QDR2018A.R), recorded in the research file coefficients/qdiabetes-2018.json (the paper prints hazard
// ratios only).
//
//   risk(10y) = 1 - S0 ^ exp(score)
//   score = ethnicity + smoking + sum(beta x (fractional-polynomial term - centre)) + beta_tds x (tds - centre)
//           + sum(binary terms) + sum(age interaction terms)
//
// Deviations from the UK inputs, all shown in the notes:
// - Townsend deprivation score has no Taiwan equivalent: 0 is used (the UK average is 0.39 for women and
//   0.52 for men in the centring values).
// - Ethnicity: white -> reference; black -> BlackCaribbean; asian -> Chinese; hispanic and other -> Other.
//   The model has no Taiwanese or Hispanic category; this mapping is an assumption, not from the paper.
// - Smoking: the model splits current smoking by cigarettes per day (light < 10, moderate 10-19, heavy 20+).
//   The app does not ask for the amount, so current smokers are scored as moderate.
// - Not asked, assumed absent: atypical antipsychotics, steroids, learning difficulty, severe mental illness,
//   gestational diabetes, polycystic ovary syndrome.

import { computed, gate, read, formatPercent, round, notApplicable, missingResult } from '../util.js';

// Model A: [beta] or [beta, centring value] per term; S0 = 10-year baseline survival.
// Source: BMJ 2017;359:j5019 via the CRAN archive QDiabetes_1.0-2 (R/QDR2018A.R lines 137-256); research file coefficients/qdiabetes-2018.json.
const COEF = {
  female: {
    S0: 0.98622727394104,
    terms: {
      "eth_Indian": [1.0695857881565456],
      "eth_Pakistani": [1.3430172097414006],
      "eth_Bangladeshi": [1.8029022579794518],
      "eth_OtherAsian": [1.127465451770802],
      "eth_BlackCaribbean": [0.421463149023991],
      "eth_BlackAfrican": [0.2850919645908353],
      "eth_Chinese": [0.88151087975892],
      "eth_Other": [0.3660573343168487],
      "smoke_Ex": [0.06560169017505905],
      "smoke_Light": [0.28450988673698374],
      "smoke_Moderate": [0.3567664381700702],
      "smoke_Heavy": [0.5359517110678775],
      "age_1": [4.340085269913928, 2.123332023620606],
      "age_2": [-0.004877170269615888, 91.64474487304688],
      "bmi_1": [2.9320361259524925, 2.571253299713135],
      "bmi_2": [-0.04740020587484349, 16.999439239501953],
      "tds": [0.03734056961804915, 0.391116052865982],
      "apsy": [0.5526764611098438],
      "ster": [0.267922336806746],
      "cvd": [0.1779722905458669],
      "gdm": [1.5248871531467574],
      "learn": [0.27835143587172717],
      "psy": [0.2618085210917906],
      "pcos": [0.3406173988206666],
      "stat": [0.6590728773280822],
      "htn": [0.4394758285813712],
      "fhdm": [0.5313359456558734],
      "age_1*apsy": [-0.8031518398316395],
      "age_2*apsy": [0.000468404118102105],
      "age_1*learn": [-0.8641596002882057],
      "age_2*learn": [0.000672496880895336],
      "age_1*stat": [-1.9757776696583935],
      "age_2*stat": [0.0023750534194347966],
      "age_1*bmi_1": [0.6553138757562945],
      "age_2*bmi_1": [-0.004471966244526305],
      "age_1*bmi_2": [-0.03620965720163018],
      "age_2*bmi_2": [0.0001185479967753342],
      "age_1*fhdm": [-0.2641171450558896],
      "age_2*fhdm": [0.00041610258289047683],
    }
  },
  male: {
    S0: 0.978732228279114,
    terms: {
      "eth_Indian": [1.1000230829124793],
      "eth_Pakistani": [1.290384012614721],
      "eth_Bangladeshi": [1.6740908848727458],
      "eth_OtherAsian": [1.1400446789147816],
      "eth_BlackCaribbean": [0.46824681690655806],
      "eth_BlackAfrican": [0.6990564996301545],
      "eth_Chinese": [0.6894365712711157],
      "eth_Other": [0.4172222846773821],
      "smoke_Ex": [0.16387409105485573],
      "smoke_Light": [0.3185144911395898],
      "smoke_Moderate": [0.3220726656778343],
      "smoke_Heavy": [0.4505243716340953],
      "age_1": [4.464232438869135, 1.496392488479614],
      "age_2": [-0.004075010801925557, 89.04817199707031],
      "bmi_1": [0.9512902786712067, 6.817805767059326],
      "bmi_2": [-0.14352488277885475, 17.801923751831055],
      "tds": [0.025918182067678725, 0.515986680984497],
      "apsy": [0.42101092346005436],
      "ster": [0.22183580932925384],
      "cvd": [0.2026960575629002],
      "learn": [0.2331532140798696],
      "psy": [0.22770449520517727],
      "stat": [0.5849007543114134],
      "htn": [0.3337939218350108],
      "fhdm": [0.6479928489936954],
      "age_1*apsy": [-0.9463772226853415],
      "age_2*apsy": [-0.0000519927442172335],
      "age_1*learn": [-0.9384237552649983],
      "age_2*learn": [0.0007102643855968814],
      "age_1*stat": [-1.74790706530033],
      "age_2*stat": [0.001350836459953167],
      "age_1*bmi_1": [0.45147599241879766],
      "age_2*bmi_1": [-0.001179772239456031],
      "age_1*bmi_2": [-0.10795481262776381],
      "age_2*bmi_2": [0.0002147150913931929],
      "age_1*fhdm": [-0.601185304293012],
      "age_2*fhdm": [0.0004914185594087803],
    }
  }
};

export const QD_ETHNICITY = { white: null, black: 'BlackCaribbean', asian: 'Chinese', hispanic: 'Other', other: 'Other' };
const FLAGS = ['apsy', 'ster', 'cvd', 'gdm', 'learn', 'psy', 'pcos', 'stat', 'htn', 'fhdm'];
export const QD_TDS_ASSUMED = 0;

// Fractional-polynomial terms before centring. age in years, bmi kg/m2, fpg mmol/L, hba1c mmol/mol.
function raw(female, x) {
  const da = x.age / 10;
  const db = Math.min(Math.max(x.bmi, 20), 40) / 10;
  const r = {
    age_1: female ? Math.sqrt(da) : Math.log(da),
    age_2: da ** 3,
    bmi_1: female ? db : db ** 2,
    bmi_2: db ** 3
  };
  if (x.fpg !== undefined) {
    const p = female ? -1 : -0.5;
    r.fpg_1 = x.fpg ** p;
    r.fpg_2 = Math.log(x.fpg) * x.fpg ** p;
  }
  if (x.hba1c !== undefined) {
    r.hba1c_1 = Math.sqrt(x.hba1c / 10);
    r.hba1c_2 = x.hba1c / 10;
  }
  return r;
}

// x = { age, bmi, ethn (model category or null), smoke ('Non'|'Ex'|'Light'|'Moderate'|'Heavy'), tds,
//       flags: { stat: true, ... }, fpg?, hba1c? }. Returns { risk, score, rows }.
export function qdRisk(coef, female, x) {
  const c = coef[female ? 'female' : 'male'];
  const r = raw(female, x);
  const v = {};
  for (const k of Object.keys(r)) v[k] = r[k] - c.terms[k][1];
  const flag = (k) => (x.flags && x.flags[k] ? 1 : 0);
  const rows = [];
  let score = 0;
  for (const [key, [beta, centre]] of Object.entries(c.terms)) {
    let xv;
    if (key.startsWith('eth_')) xv = x.ethn && key === 'eth_' + x.ethn ? 1 : 0;
    else if (key.startsWith('smoke_')) xv = key === 'smoke_' + x.smoke ? 1 : 0;
    else if (key === 'tds') xv = (x.tds || 0) - centre;
    else if (key in v) xv = v[key];
    else if (key.includes('*')) {
      const [a, b] = key.split('*');
      xv = v[a] * (b in v ? v[b] : flag(b));
    } else xv = flag(key);
    score += beta * xv;
    if (xv !== 0) rows.push({ key, beta, x: xv, contribution: beta * xv });
  }
  return { risk: 1 - Math.pow(c.S0, Math.exp(score)), score, rows };
}

// Hazard ratio of statin use at a given age (paper text: model B men, ages 35/45/55/65).
export function qdStatinHR(coef, female, age) {
  const c = coef[female ? 'female' : 'male'].terms;
  const r = raw(female, { age, bmi: 25 });
  const a1 = r.age_1 - c.age_1[1];
  const a2 = r.age_2 - c.age_2[1];
  return Math.exp(c.stat[0] + c['age_1*stat'][0] * a1 + c['age_2*stat'][0] * a2);
}

const SMOKE = { never: 'Non', former: 'Ex', current: 'Moderate' };

// Builds one formula object for model A, B or C. opts.lab = null | { field, label, toModel, range, unit }.
export function makeQdiabetes(opts, coef) {
  const meta = {
    id: opts.id,
    name: opts.name,
    disease: 'diabetes',
    outcome: 'Type 2 diabetes within 10 years',
    horizonYears: 10,
    kind: 'risk',
    derivedIn: 'EU',
    ageRange: [25, 84],
    population: 'England, QResearch primary-care records: adults aged 25 to under 85 without diabetes. Not built on Taiwanese people.',
    source: {
      citation: 'Hippisley-Cox J, Coupland C. Development and validation of QDiabetes-2018 risk prediction algorithm to estimate future risk of type 2 diabetes: cohort study. BMJ 2017;359:j5019. Coefficients: CRAN archive QDiabetes_1.0-2.',
      doi: '10.1136/bmj.j5019'
    },
    equation: '10-year risk = 1 − S0^exp(score); score = ethnicity + smoking + Σ β·(fractional-polynomial term − centre) + β·(Townsend − centre) + Σ binary terms + Σ age interactions (separate β, centres and S0 for women and men)',
    inputs: ['age', 'sex', 'smoking', 'heightCm', 'weightKg', 'familyDiabetes', 'bpTreated', 'cvdHistory', 'statin']
      .concat(opts.lab ? [opts.lab.field] : [])
  };
  return Object.assign(meta, {
    compute(person) {
      const early = gate(this, person, (p) =>
        p.profile && p.profile.diabetes === true ? 'Already has diabetes; QDiabetes estimates the chance of developing it.' : '');
      const eth = read(person, 'ethnicity');
      const ethOk = Object.prototype.hasOwnProperty.call(QD_ETHNICITY, eth);
      if (early && early.status !== 'missing') return early;
      if (early || !ethOk) return missingResult(this, (early ? early.missing : []).concat(ethOk ? [] : [{ field: 'ethnicity', label: 'Ethnicity' }]));
      const p = person.profile;
      const female = p.sex === 'female';
      const heightM = Number(p.heightCm) / 100;
      const bmiRaw = Number(p.weightKg) / (heightM * heightM);
      const x = {
        age: Number(p.age), bmi: bmiRaw, ethn: QD_ETHNICITY[eth], smoke: SMOKE[p.smoking], tds: QD_TDS_ASSUMED,
        flags: { cvd: p.cvdHistory === true, stat: p.statin === true, htn: p.bpTreated === true, fhdm: p.familyDiabetes === 'first' }
      };
      const notes = [];
      if (opts.lab) {
        const conv = opts.lab.toModel(Number(read(person, opts.lab.field)));
        if (!(conv >= opts.lab.range[0] && conv < opts.lab.range[1])) {
          return notApplicable(this, `${opts.lab.label} of ${round(conv, 1)} ${opts.lab.unit} is outside ${opts.lab.range[0]}–${opts.lab.range[1]} ${opts.lab.unit}, the range this model was built on.`);
        }
        x[opts.lab.key] = conv;
        notes.push(opts.lab.note);
      }
      const { risk, score, rows } = qdRisk(coef, female, x);
      const terms = rows.map((r) => ({ label: r.key, input: '', beta: r.beta, x: round(r.x, 6), contribution: round(r.contribution, 6) }));
      if (bmiRaw < 20 || bmiRaw > 40) notes.push(`BMI ${round(bmiRaw, 1)} is outside 20–40; the model uses ${bmiRaw < 20 ? 20 : 40}.`);
      notes.push(
        'Townsend deprivation score has no Taiwan equivalent: 0 is used (UK average about 0.4–0.5 in the centring values).',
        `Ethnicity "${eth}" is scored as ${QD_ETHNICITY[eth] || 'the white reference group'}; the model has no Taiwanese or Hispanic category (assumption).`,
        p.smoking === 'current' ? 'Current smoking is scored as moderate (10–19 a day); the amount is not asked.' : 'Smoking amount is not needed for this person.',
        'Not asked and assumed absent: atypical antipsychotics, steroids, learning difficulty, severe mental illness, gestational diabetes, polycystic ovary syndrome.',
        'Family history counts a parent or sibling with diabetes (first-degree relative).',
        `Linear predictor ${round(score, 4)}; S0(10) = ${coef[female ? 'female' : 'male'].S0}. Built on a UK cohort; not validated in Taiwan.`
      );
      return computed(this, { value: risk, display: formatPercent(risk), terms, notes });
    }
  });
}

export const qdiabetes2018 = makeQdiabetes({ id: 'qdiabetes-2018', name: 'QDiabetes-2018 (model A, no blood test)', lab: null }, COEF);
export const QDIABETES_A_COEF = COEF;
