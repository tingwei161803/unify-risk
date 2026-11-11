// PLCOm2012: 6-year risk of lung cancer in ever-smokers.
// Tammemagi MC, et al. N Engl J Med 2013;368:728-736.
// Table 2 (PDF p.4): modified logistic regression fitted on 36,286 ever-smokers in the PLCO control arm.
// All numbers below are copied from js/data/coefficients.js (COEFFICIENTS.plcom2012), which records
// Table 2 and its footnote. The paper prints no worked example; checks are self-computed.
// Unconfirmed: the paper's Table 2 gives no age range. 55-74 is the PLCO enrolment range, not taken from
// the research files.

import { computed, bmi, formatPercent, round } from '../util.js';
import { gateCancer, isNum, isBool, isEthnicity } from './_cancer-util.js';

const INTERCEPT = -4.532506;
// Table 2 betas and centring values (PDF p.4).
const B = {
  age: 0.0778868, education: -0.0812744, bmi: -0.0274194, copd: 0.3553063, cancerHistory: 0.4589971,
  familyLung: 0.587185, currentSmoker: 0.2597431, intensity: -1.822606, duration: 0.0317321, quit: -0.0308572
};
const RACE_BETA = { white: 0, black: 0.3944778, hispanic: -0.7434744, asian: -0.466585 };
const CENTER = { age: 62, education: 4, bmi: 27, duration: 27, quit: 10, intensity: 0.4021541613 };

// Education level 1-6 from years of school when the six-level answer is not given.
// Approximation (not in the paper): <12 -> 1, 12 -> 2, 13 -> 3, 14-15 -> 4, 16 -> 5, 17+ -> 6.
function levelFromYears(y) {
  return y < 12 ? 1 : y === 12 ? 2 : y === 13 ? 3 : y < 16 ? 4 : y === 16 ? 5 : 6;
}

// Pure equation, exported for checks.
export function plcoLogit(x) {
  const intensity = Math.pow(x.cpd / 10, -1) - CENTER.intensity;
  return INTERCEPT
    + B.age * (x.age - CENTER.age)
    + RACE_BETA[x.race]
    + B.education * (x.education - CENTER.education)
    + B.bmi * (x.bmi - CENTER.bmi)
    + B.copd * x.copd + B.cancerHistory * x.cancerHistory + B.familyLung * x.familyLung
    + B.currentSmoker * x.current
    + B.intensity * intensity
    + B.duration * (x.duration - CENTER.duration)
    + B.quit * (x.quit - CENTER.quit);
}
export const plcoProbability = (x) => 1 / (1 + Math.exp(-plcoLogit(x)));

export const plcom2012 = {
  id: 'plcom2012',
  name: 'PLCOm2012',
  disease: 'lung cancer',
  outcome: 'Lung cancer within 6 years (ever-smokers)',
  horizonYears: 6,
  kind: 'risk',
  derivedIn: 'US',
  ageRange: [55, 74],
  population: 'Ever-smokers in the US PLCO trial control arm (36,286 people). Never-smokers are outside the model.',
  source: {
    citation: 'Tammemägi MC, et al. N Engl J Med 2013;368:728–736. Table 2.',
    doi: '10.1056/NEJMoa1211776'
  },
  equation: 'logit = −4.532506 + 0.0778868(age−62) + race term − 0.0812744(education−4) − 0.0274194(BMI−27) + 0.3553063·COPD + 0.4589971·cancer history + 0.587185·family lung cancer + 0.2597431·current smoker − 1.822606·((cigarettes per day/10)^−1 − 0.4021541613) + 0.0317321(years smoked−27) − 0.0308572(years since quit−10); risk = 1/(1+e^−logit)',
  inputs: ['age', 'smoking', 'ethnicity', 'educationYears', 'heightCm', 'weightKg', 'copd', 'cancerHistory',
    'familyLungCancer', 'cigsPerDay', 'yearsSmoked', 'yearsSinceQuit'],

  compute(person) {
    const p = (person && person.profile) || {};
    const former = p.smoking === 'former';
    const cpdDirect = isNum(p.cigsPerDay) && Number(p.cigsPerDay) > 0;
    const cpdFromPack = isNum(p.packYears) && isNum(p.yearsSmoked) && Number(p.packYears) > 0 && Number(p.yearsSmoked) > 0;
    const numeric = ['age', 'smoking', 'heightCm', 'weightKg', 'yearsSmoked'];
    if (former) numeric.push('yearsSinceQuit');
    const early = gateCancer(this, person, {
      numeric,
      custom: {
        ethnicity: isEthnicity,
        copd: isBool,
        cancerHistory: isBool,
        familyLungCancer: isBool,
        cigsPerDay: () => cpdDirect || cpdFromPack,
        educationLevel: () => isNum(p.educationLevel) || isNum(p.educationYears)
      },
      exclusion: (q) => {
        const pr = q.profile || {};
        if (pr.smoking === 'never') return 'PLCOm2012 was built on ever-smokers; this person has never smoked.';
        if (pr.ethnicity === 'other') return 'PLCOm2012 has no single coefficient for "other" ethnicity (it lists American Indian/Alaska Native and Pacific Islander groups separately).';
        return '';
      }
    });
    if (early) return early;

    const notes = [];
    let cpd;
    if (cpdDirect) cpd = Number(p.cigsPerDay);
    else {
      cpd = (Number(p.packYears) * 20) / Number(p.yearsSmoked);
      notes.push(`Cigarettes per day estimated from pack-years: ${p.packYears} pack-years × 20 ÷ ${p.yearsSmoked} years = ${round(cpd, 1)}.`);
    }
    let edu;
    if (isNum(p.educationLevel)) edu = Number(p.educationLevel);
    else {
      edu = levelFromYears(Number(p.educationYears));
      notes.push(`Education level ${edu} (of 1–6) estimated from ${p.educationYears} years of school; this mapping is an approximation, not from the paper.`);
    }
    const x = {
      age: Number(p.age), race: p.ethnicity, education: edu, bmi: bmi(p),
      copd: p.copd ? 1 : 0, cancerHistory: p.cancerHistory ? 1 : 0, familyLung: p.familyLungCancer ? 1 : 0,
      current: p.smoking === 'current' ? 1 : 0, cpd, duration: Number(p.yearsSmoked),
      quit: former ? Number(p.yearsSinceQuit) : 0
    };
    if (!former) notes.push('Current smoker: years since quitting is set to 0 (the paper does not say what to enter).');
    const intensity = Math.pow(cpd / 10, -1) - CENTER.intensity;
    const rows = [
      ['Age', `${x.age} years`, B.age, x.age - CENTER.age],
      [`Ethnicity (${x.race})`, x.race, 1, RACE_BETA[x.race]],
      ['Education level', `${edu} of 6`, B.education, edu - CENTER.education],
      ['BMI', `${round(x.bmi, 1)} kg/m²`, B.bmi, x.bmi - CENTER.bmi],
      ['COPD', x.copd ? 'yes' : 'no', B.copd, x.copd],
      ['Personal cancer history', x.cancerHistory ? 'yes' : 'no', B.cancerHistory, x.cancerHistory],
      ['Parent, sibling or child with lung cancer', x.familyLung ? 'yes' : 'no', B.familyLung, x.familyLung],
      ['Current smoker', x.current ? 'yes' : 'no', B.currentSmoker, x.current],
      ['Smoking intensity ((cigarettes/10)^−1 − 0.4021541613)', `${round(cpd, 1)} per day`, B.intensity, intensity],
      ['Years smoked', `${x.duration} years`, B.duration, x.duration - CENTER.duration],
      ['Years since quitting', `${x.quit} years`, B.quit, x.quit - CENTER.quit]
    ];
    const terms = [{ label: 'Intercept', input: '', beta: INTERCEPT, x: 1, contribution: INTERCEPT }]
      .concat(rows.map(([label, input, beta, xv]) => ({ label, input, beta, x: xv, contribution: beta * xv })));
    const value = plcoProbability(x);
    return computed(this, {
      value,
      display: formatPercent(value),
      terms,
      notes: notes.concat('Estimates the chance of a lung cancer diagnosis in 6 years for people who have smoked; it does not cover people who never smoked.')
    });
  }
};
