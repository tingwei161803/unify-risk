# Sample lab reports (fictional)

Every person, clinic and value in these files is fictional. Nobody here is real and no value comes from a real record. The files exist so that report recognition (#6) has reports to read, and so its output can be checked against values we already know.

| File | Person | Report date | What it tests |
| --- | --- | --- | --- |
| `chen-2023-11.pdf` | Mr. Chen (`chen`) | 2023-11-08 | Earlier year: the numbers worsen from 2023 to 2026 |
| `chen-2024-11.pdf` | Mr. Chen (`chen`) | 2024-11-06 | Earlier year |
| `chen-2025-11.pdf` | Mr. Chen (`chen`) | 2025-11-05 | Earlier year |
| `chen-2026-11.pdf` | Mr. Chen (`chen`) | 2026-11-06 | Clean one-column PDF |
| `chen-2026-11.png` | Mr. Chen (`chen`) | 2026-11-06 | The same page as a straight image |
| `wang-2026-11.pdf` | Ms. Wang (`wang`) | 2026-11-04 | Two-column layout; no blood count and no UACR on this report |
| `wu-2026-11.pdf` | Mr. Wu (`wu`) | 2026-11-07 | One column, many flagged values (H and L) |
| `tsai-2026-11.pdf` | Ms. Tsai (`tsai`) | 2026-11-05 | One column, kidney values flagged |
| `tsai-2026-11.png` | Ms. Tsai (`tsai`) | 2026-11-05 | Looks like a phone photo: tilted page, shadow, off-white paper |
| `kao-2026-11.pdf` | Mr. Kao (`kao`) | 2026-11-08 | One column, mostly near the reference ranges |

Each report shows the clinic, name, sex and age, report date, and one table per section (body measurements, blood pressure, blood sugar, lipids, kidney, liver, blood count) with the columns test, result, unit, reference range and flag. A watermark reads "FICTIONAL SAMPLE — not a real person".

## Where the numbers come from

- Each file prints one report from `js/data/reports.js` that has a `file` path: its clinic (`lab`), report type, date, and every item's label, value, unit, printed range and flag.
- If `js/data/reports.js` is missing, the generator falls back to each person's latest report in `js/data/personas.js` and works the flags out from the printed range.
- Results are printed with a fixed number of decimals per test (creatinine 1.0 prints as `1.00`, height 168 as `168.0`), so compare recognition output numerically.

The answer key for checking recognition output is `js/data/reports.js`.

## Rebuild

```bash
node tools/build-sample-reports.mjs
```

The generator is an offline tool, not part of the app. It needs `js/data/personas.js` and `js/data/reports.js` (#10) and headless Chrome; set `CHROME=/path/to/chrome` if Chrome is not in the default macOS location.
