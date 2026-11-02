# OMR model artifacts

The current checkpoints are small (about 150 KB each) and contain no applicant
images or names. They should be versioned directly with the repository together
with their JSON reports and model cards; Git LFS is not necessary at this size.

The raw answer-sheet dataset and generated crops remain ignored by Git because
they are larger and may contain personal information. Keep that dataset in a
separately access-controlled backup. A model card records the manifest SHA-256
so the exact local dataset index used for evaluation can be identified.

## Production candidate

`final_three_class/best.pt` is the current three-class candidate. Verify it from
the `omr/` directory:

```powershell
python tools/evaluate_model.py `
  --checkpoint models/final_three_class/best.pt `
  --manifest dataset/crops/_manifest.csv `
  --model-card models/final_three_class/model_card.json `
  --split test `
  --device cpu `
  --expected-report models/final_three_class/test_report.json
```

The evaluator first rejects any checkpoint or manifest whose SHA-256 differs
from the model card. Reference-report comparisons require CPU execution and must
then reproduce the saved class counts, confusion matrix, loss, accuracy,
balanced accuracy, and macro F1 before the checkpoint is used by the recognition
service.

## Production full-sheet validation

The production decision policy applies an erasure probability threshold of
`0.80`, selected on validation sheets 020–022. This addresses the raw argmax
model's known erasure false-positive rate without changing its weights. The
locked sheets 023–025 were not used to select the threshold and achieve 97.0%
exact item recognition.

The split-specific checks can be reproduced with `--split val` and
`--split test`; `--erasure-threshold` evaluates an explicit candidate without
changing the checkpoint or model card.

Validate truth-independent registration, all 410 crops, production bubble
decisions, and 100 item states across the local 25-sheet dataset:

```powershell
python tools/validate_pipeline.py `
  --output models/final_three_class/pipeline_report.json
```

The recorded report has exact crop parity for all 10,250 crops, 99.23%
production bubble accuracy, 97.04% exact item accuracy, and 98.02% valid-answer
accuracy. These measurements use the existing scanned-sheet dataset; phone
captures still require field validation.

Production startup verifies the checkpoint, calibrated template, and packaged
reference image against the model card. The pipeline report is also hashed in
the card so the recorded full-sheet evidence cannot silently drift.

Recognize one sheet without truth labels:

```powershell
python tools/recognize_sheet.py `
  --image dataset/raw_sheets/sheet_001.jpg `
  --output recognition.json `
  --debug-overlay recognition-overlay.png
```

Add `--answer-key key.json` to validate the complete 100-item key and calculate
weighted points, percentage, correct/incorrect counts, and Passed/Failed status.

## Training reproducibility limitation

The original training script and full hyperparameter/augmentation recipe were
not preserved with these checkpoints. The network architecture, preprocessing,
checkpoint loading, and held-out evaluation are now reproducible, but retraining
an identical checkpoint is not yet guaranteed. A future training run must save
its complete configuration and command alongside the resulting model.
