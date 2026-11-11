// COPD-PS: a 5-question self-scored form that points to possible airflow limitation (COPD) that has not been found yet.
// Martinez FJ, et al. Development and initial validation of a self-scored COPD Population Screener
// Questionnaire (COPD-PS). COPD 2008;5:85-95. Points: Table 4 (PDF p.5); cut-off performance: Table 6 (p.7).
//
// Each answer is given as its position in the printed option list (0 = first option):
//   breathless in past 4 weeks (none, a little, some, most, all of the time): 0, 0, 1, 2, 2
//   coughs up phlegm (no never, only with colds, few days a month, most days a week, every day): 0, 0, 1, 1, 2
//   done less than before in past 12 months because of breathing (strongly disagree, disagree, unsure,
//     agree, strongly agree): 0, 0, 0, 1, 2
//   smoked at least 100 cigarettes in life: no 0, yes 2
//   age: 35-49: 0, 50-59: 1, 60-69: 2, 70+: 2.   Total 0-10.
// The paper suggests a cut-off of 5 or 6 (p.6). Table 6 performance (against lung function testing):
//   5 or more: sensitivity 84.4%, specificity 60.7%, PPV 56.8%, NPV 86.4%;
//   6 or more: sensitivity 73.4%, specificity 73.6%, PPV 63.0%, NPV 81.9%.
// (Whether rows 5-9 mean "or more" is not written in the paper; read as "or more".)
// The score marks who might ask for a lung function test; it is not a risk of getting COPD. Ages 35 and over.

import { computed, gate, notApplicable } from '../util.js';

const BREATH = [0, 0, 1, 2, 2];
const PHLEGM = [0, 0, 1, 1, 2];
const LIMITED = [0, 0, 0, 1, 2];
const SMOKED_100 = 2;
const CUTOFF = 5;
const CUTOFF_HIGH = 6;

export function copdAgePoints(age) {
  return age >= 70 ? 2 : age >= 60 ? 2 : age >= 50 ? 1 : 0;
}

// Exposed for checks. Answers as option positions; smoked100 is boolean.
export function copdPsScore(breath, phlegm, limited, smoked100, age) {
  return BREATH[breath] + PHLEGM[phlegm] + LIMITED[limited] + (smoked100 ? SMOKED_100 : 0) + copdAgePoints(age);
}

const validOption = (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 4;

export const copdPs = {
  id: 'copd-ps',
  name: 'COPD-PS',
  disease: 'copd',
  outcome: 'Possible airflow limitation (COPD) not yet found (now)',
  horizonYears: null,
  kind: 'score',
  derivedIn: 'US',
  ageRange: [35, null],
  population: 'US adults aged 35 and over answering a short form, checked against lung function testing (post-bronchodilator FEV1/FVC below 70%).',
  source: {
    citation: 'Martinez FJ, et al. Development and initial validation of a self-scored COPD Population Screener Questionnaire (COPD-PS). COPD 2008;5:85–95.',
    doi: '10.1080/15412550801940721'
  },
  equation: 'score = breathlessness (0–2) + phlegm (0–2) + less active (0–2) + smoked 100 cigarettes (0 or 2) + age (0–2); 5 or more suggests asking about a lung function test',
  inputs: ['age', 'copdSymptomBreathless', 'copdSymptomPhlegm', 'copdActivityLimited', 'smoked100Cigarettes'],

  compute(person) {
    const early = gate(this, person, (p) =>
      p.profile && p.profile.copdDiagnosed === true ? 'Already told they have COPD; this form looks for COPD that has not been found.' : '');
    if (early) return early;
    const p = person.profile;
    const opts = [p.copdSymptomBreathless, p.copdSymptomPhlegm, p.copdActivityLimited];
    if (!opts.every(validOption)) {
      return notApplicable(this, 'Answers must be option positions 0 to 4.');
    }
    const [b, ph, lim] = opts.map(Number);
    const age = Number(p.age);
    const smoked = p.smoked100Cigarettes === true;
    const terms = [
      { label: 'Short of breath in the past 4 weeks', input: `option ${b}`, points: BREATH[b] },
      { label: 'Coughs up phlegm', input: `option ${ph}`, points: PHLEGM[ph] },
      { label: 'Does less than before because of breathing', input: `option ${lim}`, points: LIMITED[lim] },
      { label: 'Smoked at least 100 cigarettes in life', input: smoked ? 'yes' : 'no', points: smoked ? SMOKED_100 : 0 },
      { label: `Age ${age >= 70 ? '70 or over' : age >= 60 ? '60–69' : age >= 50 ? '50–59' : '35–49'}`, input: `${age} years`, points: copdAgePoints(age) }
    ];
    const total = terms.reduce((s, t) => s + t.points, 0);
    return computed(this, {
      value: total,
      display: `${total} points (of 10)`,
      score: { points: total, max: 10 },
      band: {
        label: total >= CUTOFF
          ? `${CUTOFF} or more: the paper suggests discussing a lung function test`
          : `Below ${CUTOFF}: under the paper's suggested cut-off`,
        aboveCutoff: total >= CUTOFF
      },
      terms,
      notes: [
        `Cut-off 5 or more: sensitivity 84.4%, specificity 60.7%, PPV 56.8%, NPV 86.4%. Cut-off ${CUTOFF_HIGH} or more: 73.4%, 73.6%, 63.0%, 81.9% (Table 6).`,
        'This is a short form that points to a possible need for a lung function test; it is not a diagnosis and not a future risk. Answers are the position in the printed option list, 0 for the first option.'
      ]
    });
  }
};
