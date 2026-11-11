// Formula groups added for issue #69. Each group file (js/engine/formulas/_group-*.js)
// exports `formulas`, `checks()` and `fieldLabels`. This file registers their input
// fields once (labels, and which fields are yes/no, a fixed choice or free text) so
// util.js can list what is missing and validate inputs by type.

import * as cvd from './formulas/_group-cvd.js';
import * as brainMortality from './formulas/_group-brain-mortality.js';
import * as cancer from './formulas/_group-cancer.js';
import * as liverCopd from './formulas/_group-liver-copd.js';
import { registerFields } from './util.js';

export const GROUPS = [cvd, brainMortality, cancer, liverCopd];

registerFields({
  labels: Object.assign({}, ...GROUPS.map((g) => g.fieldLabels || {})),
  booleans: [
    'statin', 'urban', 'familyAscvd', 'strokeHistory', 'familyDementia', 'depression',
    'hypertensionDiagnosed', 'highCholesterolDiagnosed', 'cancerHistory', 'lungDisease', 'heartFailure',
    'aspirin', 'livesAlone', 'difficultyBathing', 'difficultyManagingMoney', 'difficultyWalkingBlock',
    'difficultyPushingObjects', 'needsHelpDailyTasks', 'difficultyWalkingQuarterMile', 'walkingSpeedFast',
    'weightChange3kgLastYear', 'copd', 'familyLungCancer', 'familyColorectalCancer', 'atypicalHyperplasia',
    'dreAbnormal', 'priorNegativeBiopsy', 'familyProstateCancer',
    'hbvCarrier', 'hbvTreated', 'hcv', 'cirrhosis', 'chronicLiverDisease', 'regularDrinking',
    'smoked100Cigarettes', 'copdDiagnosed', 'labs.hbeagPositive'
  ],
  choices: {
    ethnicity: ['white', 'black', 'hispanic', 'asian', 'other'],
    selfRatedHealth: ['excellent', 'verygood', 'good', 'fair', 'poor']
  },
  strings: ['region']
});
