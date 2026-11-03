# Code Nexus OMR service

The service converts one TMC answer-sheet image into 410 bubble predictions and
100 item decisions. It can also validate a complete answer key and calculate a
weighted percentage, correct/incorrect counts, and Passed/Failed status.

```text
JPEG/PNG capture
  -> SIFT registration (quadrilateral fallback)
  -> printed-ring lattice refinement
  -> 410 calibrated 44x44 crops
  -> BubbleCNN probabilities and production thresholds
  -> 100 answered / blank / invalid item states
  -> optional answer-key scoring
```

The PyTorch checkpoint runs on this server. The Android application should
capture and upload the sheet through Laravel; it should not bundle `best.pt`.

## Run locally

From `omr/`:

```powershell
python -m pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5005
```

Dependencies are pinned to the model-card-tested CPU environment. The Docker
image installs PyTorch from the official CPU wheel index so production builds
do not download unused CUDA libraries.

Useful endpoints:

- `GET /health`
- `GET /sheet-config`
- `POST /recognize`
- Interactive API documentation: `GET /docs`

`POST /recognize` is multipart form data:

| Field | Required | Description |
| --- | --- | --- |
| `file` | yes | JPEG/PNG answer sheet, maximum 10 MB / 40 megapixels |
| `answer_key` | no | JSON text containing `passing_score` and all 100 key items |
| `answer_key_id` | no | Optional consistency check/response metadata; cannot replace `answer_key` |

Each key item uses `section`, `item_number`, `correct_answer`, and optional
`points`. A key must contain every canonical item exactly once. Unknown
sections, duplicate/missing items, and options outside the section range are
rejected with HTTP 422.
The serialized key is capped at 1 MB.

Without a key, the response status is `recognized`. With a valid key it is
`scored` and includes `scoring`. Both forms include registration and lattice
diagnostics, warnings, model/artifact hashes, thresholds, timings, all 100 item
decisions, and per-bubble probabilities. Poor lattice alignment is rejected
instead of returning an unsafe score.

## CLI and validation

```powershell
python tools/recognize_sheet.py `
  --image dataset/raw_sheets/sheet_001.jpg `
  --output recognition.json `
  --debug-overlay recognition-overlay.png

python tools/validate_pipeline.py `
  --output models/final_three_class/pipeline_report.json
```

Add `--answer-key key.json` to the first command for scoring. The second command
uses truth only after recognition and verifies byte-for-byte crop parity against
the ignored local dataset.
Use `--split val` or `--split test` for split-specific evidence, and
`--erasure-threshold` only when evaluating an explicit threshold candidate.

The recorded 25-sheet validation has exact parity for all 10,250 crops, 99.23%
production bubble accuracy, 97.04% exact item accuracy, and 98.02% valid-answer
accuracy. The locked three-sheet test split achieves 97.0% exact item accuracy.
Additional real phone captures under varied devices, angles, and lighting remain
required before broad field deployment.

## Configuration

Artifact hashes and production thresholds are versioned in the model card.
Runtime paths and execution settings can be overridden for deployment:

- `OMR_CHECKPOINT`
- `OMR_MODEL_CARD`
- `OMR_TEMPLATE`
- `OMR_REFERENCE`
- `OMR_DEVICE` (default `cpu`)
- `OMR_BATCH_SIZE` (default `128`)
- `OMR_LOW_CONFIDENCE_THRESHOLD`
- `OMR_ERASURE_THRESHOLD`

The service refuses to start recognition if the checkpoint, template, or
reference image differs from the SHA-256 values recorded in the model card.
