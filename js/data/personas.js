// Fictional sample people for the demo. Every sample person here is fictional;
// nobody here is real, and no value comes from a real record.
//
// Seven people, chosen so that every round-1 formula applies to all of them
// (FSRP 55-84, Chin-Shan >=35, FINDRISC 35-64, CAIDE 39-64):
//   lin, linda   one person from Taiwan and one from the United States. Run the
//                same person through the US formula (FSRP) and the Taiwanese one
//                (Chin-Shan) to show the gap.
//   chen, wang, wu, tsai, kao
//                five people in Taiwan, aged 60-64, who have just retired and are
//                worried about dementia. All five have parents or siblings with
//                high blood pressure, high cholesterol and diabetes, and none has
//                any known disease (no diabetes, no blood-pressure medicine, no
//                atrial fibrillation, no heart disease, no stroke). Their check-up
//                numbers are borderline in different ways.
//
// Shape of one persona
//   id              string, stable key (used in URLs and localStorage)
//   region          'TW' | 'US'
//   name, tagline, blurb   display text (English)
//   populationIds   ids into POPULATIONS in js/data/evidence.js; the evidence
//                   page highlights these rows for this person
//   profile         questionnaire answers (no blood test needed)
//   labs            lab values; units are in the key name. Missing = not tested.
//   report          optional: the check-up report the labs came from
//                   { date, type, printedRanges: { <key>: range as printed } }
//
// Profile fields and the formulas that read them
//   age (years), sex ('male' | 'female')                     all
//   heightCm, weightKg -> BMI                                 FINDRISC, CAIDE
//   waistCm                                                   FINDRISC
//   educationYears                                            CAIDE
//   smoking ('never' | 'former' | 'current')                  FSRP (current only)
//   sbp, dbp (mmHg)                                           FSRP, Chin-Shan, CAIDE
//   bpTreated (takes blood-pressure medicine)                 FSRP, FINDRISC
//   diabetes                                                  FSRP, Chin-Shan
//   highGlucoseHistory (ever told glucose was high)           FINDRISC
//   afib (atrial fibrillation)                                FSRP, Chin-Shan
//   cvdHistory (heart attack, angina, heart failure, PAD)     FSRP
//   strokeHistory (had a stroke; optional)                    FSRP, Chin-Shan:
//                                                             true -> not applicable
//   familyStroke (parent or sibling had a stroke)             Chin-Shan
//   familyDiabetes ('none' | 'second' | 'first' degree)       FINDRISC
//   active30minDaily (>=30 min activity most days)            FINDRISC
//   exerciseTwiceWeekly (leisure exercise >=2 times a week)   CAIDE
//   vegFruitDaily                                             FINDRISC
//
// Context-only profile fields (no round-1 formula reads them; the report and
// the explanation text use them)
//   familyDementia, familyHypertension, familyHighCholesterol
//   livesAlone, hearingLoss, sleepProblem, retiredRecently
//   worry           what the person is worried about, e.g. 'dementia'
//
// Lab fields
//   totalCholMgDl     Chin-Shan (lab version), CAIDE (>6.5 mmol/L = >251 mg/dL)
//   hdlMgDl           not used in round 1; kept for PREVENT later
//   fastingGlucoseMgDl  Chin-Shan (lab version)
//   hba1cPct          not used in round 1
//   ldlMgDl, tgMgDl, creatinineMgDl, egfrMlMin (mL/min/1.73 m2), uacrMgG
//   (urine albumin-to-creatinine ratio, mg/g), astUL, altUL (U/L),
//   plateletsK (10^3/uL)
//                     not used by round-1 formulas; read by the lab standards
//                     (js/engine/labs.js) and the report
//
// report.printedRanges keys are the lab keys above plus bmi, waistCm, sbp and
// dbp, with the reference range exactly as the check-up report printed it.

export const PERSONAS = [
  {
    id: 'lin',
    region: 'TW',
    name: 'Mr. Lin',
    tagline: '62 · Taipei · smokes, blood pressure untreated',
    blurb: 'His father had a stroke at 70. His check-up says his blood pressure is "a bit high", and he has never taken medicine for it.',
    populationIds: ['tw', 'men'],
    profile: {
      age: 62,
      sex: 'male',
      heightCm: 168,
      weightKg: 76,
      waistCm: 95,
      educationYears: 12,
      smoking: 'current',
      sbp: 148,
      dbp: 92,
      bpTreated: false,
      diabetes: false,
      highGlucoseHistory: true,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: true,
      familyDiabetes: 'second',
      active30minDaily: false,
      exerciseTwiceWeekly: false,
      vegFruitDaily: true
    },
    labs: {
      totalCholMgDl: 212,
      hdlMgDl: 41,
      fastingGlucoseMgDl: 108,
      hba1cPct: 5.9
    }
  },
  {
    id: 'linda',
    region: 'US',
    name: 'Linda',
    tagline: '58 · Ohio · on blood-pressure medicine',
    blurb: 'Her mother has type 2 diabetes. Her doctor mentioned "prediabetes" once, and she wants to know what her numbers actually mean.',
    populationIds: ['us-white', 'women'],
    profile: {
      age: 58,
      sex: 'female',
      heightCm: 163,
      weightKg: 82,
      waistCm: 98,
      educationYears: 14,
      smoking: 'never',
      sbp: 134,
      dbp: 84,
      bpTreated: true,
      diabetes: false,
      highGlucoseHistory: false,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: false,
      familyDiabetes: 'first',
      active30minDaily: false,
      exerciseTwiceWeekly: true,
      vegFruitDaily: false
    },
    labs: {
      totalCholMgDl: 228,
      hdlMgDl: 52,
      fastingGlucoseMgDl: 101,
      hba1cPct: 5.7
    }
  },
  {
    id: 'chen',
    region: 'TW',
    name: 'Mr. Chen',
    tagline: '64 · Taichung · retired civil servant, sitting much more since retiring',
    blurb: 'He retired three months ago and now sits most of the day. His mother had diabetes and was told she had Alzheimer\'s disease at 78, his father had high blood pressure and a stroke, and he is afraid the same is coming for him.',
    populationIds: ['tw', 'men'],
    profile: {
      age: 64,
      sex: 'male',
      heightCm: 168,
      weightKg: 75.6,
      waistCm: 94,
      educationYears: 16,
      smoking: 'never',
      sbp: 146,
      dbp: 92,
      bpTreated: false,
      diabetes: false,
      highGlucoseHistory: true,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: true,
      familyDiabetes: 'first',
      active30minDaily: false,
      exerciseTwiceWeekly: false,
      vegFruitDaily: true,
      familyDementia: true,
      familyHypertension: true,
      familyHighCholesterol: true,
      livesAlone: false,
      hearingLoss: true,
      sleepProblem: false,
      retiredRecently: true,
      worry: 'dementia'
    },
    labs: {
      totalCholMgDl: 238,
      hdlMgDl: 44,
      fastingGlucoseMgDl: 106,
      hba1cPct: 5.9,
      ldlMgDl: 158,
      tgMgDl: 180,
      creatinineMgDl: 1.0,
      egfrMlMin: 83,
      uacrMgG: 22,
      astUL: 24,
      altUL: 28,
      plateletsK: 230
    },
    report: {
      date: '2026-11-06',
      type: 'Self-paid health check (hospital)',
      printedRanges: {
        bmi: '18.5–24',
        waistCm: 'men <90',
        sbp: '<130/85',
        dbp: '<130/85',
        fastingGlucoseMgDl: '70–99',
        hba1cPct: '4.0–5.6',
        totalCholMgDl: '<200',
        tgMgDl: '<150',
        hdlMgDl: 'men ≥40',
        ldlMgDl: '<130',
        creatinineMgDl: '0.7–1.3',
        egfrMlMin: '≥60',
        uacrMgG: '<30',
        astUL: '≤40',
        altUL: '≤40',
        plateletsK: '150–400'
      }
    }
  },
  {
    id: 'wang',
    region: 'TW',
    name: 'Ms. Wang',
    tagline: '60 · Tainan · retired teacher, walks an hour a day',
    blurb: 'She walks an hour a day and eats well, but has slept badly since retiring. Her mother had vascular dementia, her father had high blood pressure and high cholesterol, and her brother has diabetes, so she wants to know whether her memory is at risk.',
    populationIds: ['tw', 'women'],
    profile: {
      age: 60,
      sex: 'female',
      heightCm: 158,
      weightKg: 56,
      waistCm: 76,
      educationYears: 16,
      smoking: 'never',
      sbp: 128,
      dbp: 82,
      bpTreated: false,
      diabetes: false,
      highGlucoseHistory: false,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: false,
      familyDiabetes: 'first',
      active30minDaily: true,
      exerciseTwiceWeekly: true,
      vegFruitDaily: true,
      familyDementia: true,
      familyHypertension: true,
      familyHighCholesterol: true,
      livesAlone: false,
      hearingLoss: false,
      sleepProblem: true,
      retiredRecently: true,
      worry: 'dementia'
    },
    labs: {
      totalCholMgDl: 252,
      hdlMgDl: 62,
      fastingGlucoseMgDl: 98,
      hba1cPct: 5.8,
      ldlMgDl: 168,
      tgMgDl: 110,
      creatinineMgDl: 0.68,
      egfrMlMin: 100,
      astUL: 22,
      altUL: 18
    },
    report: {
      date: '2026-11-04',
      type: 'Health check (clinic)',
      printedRanges: {
        bmi: '18.5–24',
        waistCm: 'women <80',
        sbp: '<130/85',
        dbp: '<130/85',
        fastingGlucoseMgDl: '70–99',
        hba1cPct: '4.0–5.6',
        totalCholMgDl: '<200',
        tgMgDl: '<150',
        hdlMgDl: 'women ≥50',
        ldlMgDl: '<130',
        creatinineMgDl: '0.5–1.1',
        egfrMlMin: '≥60',
        astUL: '≤40',
        altUL: '≤40'
      }
    }
  },
  {
    id: 'wu',
    region: 'TW',
    name: 'Mr. Wu',
    tagline: '62 · Kaohsiung · retired factory supervisor, smokes a pack a day',
    blurb: 'He has smoked a pack a day for 40 years and drinks most evenings. A former colleague was just told he has dementia, and with diabetes and high blood pressure on his father\'s side and high cholesterol on his mother\'s, he wonders if he is next.',
    populationIds: ['tw', 'men'],
    profile: {
      age: 62,
      sex: 'male',
      heightCm: 170,
      weightKg: 81.2,
      waistCm: 98,
      educationYears: 9,
      smoking: 'current',
      sbp: 138,
      dbp: 88,
      bpTreated: false,
      diabetes: false,
      highGlucoseHistory: true,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: false,
      familyDiabetes: 'first',
      active30minDaily: false,
      exerciseTwiceWeekly: false,
      vegFruitDaily: false,
      familyDementia: false,
      familyHypertension: true,
      familyHighCholesterol: true,
      livesAlone: false,
      hearingLoss: false,
      sleepProblem: false,
      retiredRecently: true,
      worry: 'dementia'
    },
    labs: {
      totalCholMgDl: 225,
      hdlMgDl: 35,
      fastingGlucoseMgDl: 118,
      hba1cPct: 6.1,
      ldlMgDl: 143,
      tgMgDl: 236,
      creatinineMgDl: 1.1,
      egfrMlMin: 76,
      uacrMgG: 26,
      astUL: 52,
      altUL: 71,
      plateletsK: 160
    },
    report: {
      date: '2026-11-07',
      type: 'Self-paid health check (hospital)',
      printedRanges: {
        bmi: '18.5–24',
        waistCm: 'men <90',
        sbp: '<130/85',
        dbp: '<130/85',
        fastingGlucoseMgDl: '70–99',
        hba1cPct: '4.0–5.6',
        totalCholMgDl: '<200',
        tgMgDl: '<150',
        hdlMgDl: 'men ≥40',
        ldlMgDl: '<130',
        creatinineMgDl: '0.7–1.3',
        egfrMlMin: '≥60',
        uacrMgG: '<30',
        astUL: '≤40',
        altUL: '≤40',
        plateletsK: '150–400'
      }
    }
  },
  {
    id: 'tsai',
    region: 'TW',
    name: 'Ms. Tsai',
    tagline: '63 · Taipei · retired accountant, living alone since retiring',
    blurb: 'She lives alone, sits most of the day and rarely sees friends since leaving work, and sometimes cannot find the word she wants. Her mother had diabetes and high blood pressure and her father had high cholesterol and a stroke; she worries the lost words are the start of dementia.',
    populationIds: ['tw', 'women'],
    profile: {
      age: 63,
      sex: 'female',
      heightCm: 155,
      weightKg: 66.3,
      waistCm: 86,
      educationYears: 12,
      smoking: 'never',
      sbp: 134,
      dbp: 84,
      bpTreated: false,
      diabetes: false,
      highGlucoseHistory: false,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: true,
      familyDiabetes: 'first',
      active30minDaily: false,
      exerciseTwiceWeekly: false,
      vegFruitDaily: true,
      familyDementia: false,
      familyHypertension: true,
      familyHighCholesterol: true,
      livesAlone: true,
      hearingLoss: true,
      sleepProblem: true,
      retiredRecently: true,
      worry: 'dementia'
    },
    labs: {
      totalCholMgDl: 228,
      hdlMgDl: 50,
      fastingGlucoseMgDl: 104,
      hba1cPct: 6.0,
      ldlMgDl: 146,
      tgMgDl: 160,
      creatinineMgDl: 1.08,
      egfrMlMin: 58,
      uacrMgG: 48,
      astUL: 21,
      altUL: 19,
      plateletsK: 255
    },
    report: {
      date: '2026-11-05',
      type: 'Self-paid health check (hospital)',
      printedRanges: {
        bmi: '18.5–24',
        waistCm: 'women <80',
        sbp: '<130/85',
        dbp: '<130/85',
        fastingGlucoseMgDl: '70–99',
        hba1cPct: '4.0–5.6',
        totalCholMgDl: '<200',
        tgMgDl: '<150',
        hdlMgDl: 'women ≥50',
        ldlMgDl: '<130',
        creatinineMgDl: '0.5–1.1',
        egfrMlMin: '≥60',
        uacrMgG: '<30',
        astUL: '≤40',
        altUL: '≤40',
        plateletsK: '150–400'
      }
    }
  },
  {
    id: 'kao',
    region: 'TW',
    name: 'Mr. Kao',
    tagline: '61 · Hsinchu · retired engineer, cycles every day',
    blurb: 'He cycles every day, eats carefully and quit smoking 15 years ago, but has had ringing ears and poor hearing for years. Both his parents had diabetes, his father also had high blood pressure, high cholesterol and dementia, and his mother had a stroke, so he worries his father\'s dementia runs in the family.',
    populationIds: ['tw', 'men'],
    profile: {
      age: 61,
      sex: 'male',
      heightCm: 172,
      weightKg: 70.7,
      waistCm: 88,
      educationYears: 18,
      smoking: 'former',
      sbp: 132,
      dbp: 78,
      bpTreated: false,
      diabetes: false,
      highGlucoseHistory: false,
      afib: false,
      cvdHistory: false,
      strokeHistory: false,
      familyStroke: true,
      familyDiabetes: 'first',
      active30minDaily: true,
      exerciseTwiceWeekly: true,
      vegFruitDaily: true,
      familyDementia: true,
      familyHypertension: true,
      familyHighCholesterol: true,
      livesAlone: false,
      hearingLoss: true,
      sleepProblem: true,
      retiredRecently: true,
      worry: 'dementia'
    },
    labs: {
      totalCholMgDl: 214,
      hdlMgDl: 47,
      fastingGlucoseMgDl: 102,
      hba1cPct: 5.7,
      ldlMgDl: 141,
      tgMgDl: 130,
      creatinineMgDl: 0.95,
      egfrMlMin: 91,
      uacrMgG: 12,
      astUL: 25,
      altUL: 27,
      plateletsK: 245
    },
    report: {
      date: '2026-11-08',
      type: 'Self-paid health check (hospital)',
      printedRanges: {
        bmi: '18.5–24',
        waistCm: 'men <90',
        sbp: '<130/85',
        dbp: '<130/85',
        fastingGlucoseMgDl: '70–99',
        hba1cPct: '4.0–5.6',
        totalCholMgDl: '<200',
        tgMgDl: '<150',
        hdlMgDl: 'men ≥40',
        ldlMgDl: '<130',
        creatinineMgDl: '0.7–1.3',
        egfrMlMin: '≥60',
        uacrMgG: '<30',
        astUL: '≤40',
        altUL: '≤40',
        plateletsK: '150–400'
      }
    }
  }
];

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}
