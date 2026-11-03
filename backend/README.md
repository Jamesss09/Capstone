# Code Nexus Laravel backend

Laravel is the authenticated system of record between the Android scanner,
MySQL, and the private Python OMR service. Mobile clients never receive an
answer-key file and never call Python directly.

## Staff processing flow

1. `POST /api/applicants` creates the applicant. Laravel automatically binds
   the one complete active answer key; clients cannot submit `answer_key_id`.
2. `POST /api/sheets/upload` accepts `applicant_id` and a JPEG/PNG image,
   stores the capture on Laravel's private disk, creates the answer-sheet and
   domain-job records, and dispatches `ProcessOmrSheet` to the `omr` queue.
3. The queue worker serializes the bound key and calls Python
   `POST /recognize` over the private Docker network.
4. Laravel independently verifies all 100 item outcomes and the weighted score,
   then atomically persists answers, diagnostics, result counts, and the audit
   event. Permanent/final failures also create an audit event without partial
   answers or results.
5. The mobile app polls `GET /api/omr-jobs/{job}` until `Completed` or `Failed`.

Jobs use `Queued`, `Processing`, `Completed`, and `Failed`. Transient HTTP or
service failures are retried with backoff. Capture/key/contract rejection is a
permanent job failure and stores a safe error message. A failed capture may be
replaced by uploading a new image for the same pending applicant.

## Answer-key rules

- New keys start `Inactive`.
- Only an administrator can activate a key.
- Activation requires all 100 canonical items and makes every other key
  inactive.
- Applicant identification fails if there is not exactly one complete active
  key.
- Once assigned to an applicant, key metadata/items cannot be edited or deleted.
  It may later become inactive; queued work still uses the bound immutable key.

## Runtime configuration

```dotenv
QUEUE_CONNECTION=database
DB_QUEUE=omr
DB_QUEUE_RETRY_AFTER=120
OMR_SERVICE_URL=http://omr:5005
OMR_CONNECT_TIMEOUT=5
OMR_REQUEST_TIMEOUT=60
```

Run database migrations and a local worker:

```powershell
php artisan migrate
php artisan queue:work database --queue=omr --tries=3 --timeout=75
```

Docker Compose includes the dedicated `omr-worker` service. The OMR host port is
bound to localhost for development; Laravel reaches it internally as
`http://omr:5005`.

## Verification

```powershell
php artisan test
vendor\bin\pint --test app tests database
```

The OMR feature suite covers active-key resolution, key immutability, upload
dispatch, multipart service calls, independent score verification, atomic
persistence, duplicate delivery, transient retries, permanent capture failure,
recapture, and job-poll authorization.
