# CPMS serving revision during StudyTrack's UAT (18–20 Nov 2026)

**Owner-reported check.** Run by Nuggetkub (project owner) in Cloud Shell, project `cpe334-course-p-m-s`, 2026-11-20 about 17:40 ICT. Read-only commands. The output below is transcribed from the terminal; the only change is that the "deployed by" column of the revision list is left out (personal email). No reviewer has independently re-run these commands.

## 1. Current traffic

`gcloud run services describe cpms --region=asia-southeast1 --format="yaml(status.traffic)"`

```
status:
  traffic:
  - latestRevision: true
    percent: 100
    revisionName: cpms-00007-7r8
```

## 2. Revisions

`gcloud run revisions list --service=cpms --region=asia-southeast1`

| Revision | Active | Deployed (UTC) |
| --- | --- | --- |
| cpms-00007-7r8 | yes | 2026-11-15 04:51:06 |
| cpms-00006-bhh | | 2026-11-14 17:55:25 |
| cpms-00005-xxf | | 2026-11-14 17:32:20 |
| cpms-00004-49r | | 2026-11-14 16:52:12 |
| cpms-00003-lx9 | | 2026-11-14 13:58:31 |
| cpms-00002-ttx | | 2026-11-13 22:25:37 |
| cpms-00001-gpg | | 2026-11-13 16:09:46 |

## 3. Admin activity audit log, Cloud Run, since 2026-11-15 00:00 UTC

`gcloud logging read 'logName="projects/cpe334-course-p-m-s/logs/cloudaudit.googleapis.com%2Factivity" AND protoPayload.serviceName="run.googleapis.com" AND timestamp>="2026-11-15T00:00:00Z"' --format="table(timestamp,protoPayload.methodName,protoPayload.resourceName)" --order=asc`

| Timestamp (UTC) | Method | Resource |
| --- | --- | --- |
| 2026-11-15T04:50:33Z | google.cloud.run.v1.Jobs.ReplaceJob | jobs/cpms-migrate |
| 2026-11-15T04:51:04Z | google.cloud.run.v1.Services.ReplaceService | services/cpms |
| 2026-11-15T04:51:19Z | google.cloud.run.v1.Services.ReplaceService | services/cpms |

## Conclusion

The only Cloud Run changes since 15 Nov are the `v0.3.0` release deploy on 2026-11-15 04:50–04:51 UTC (11:50–11:51 ICT), which created `cpms-00007-7r8`. There is no deploy, traffic change or service update after 2026-11-15 04:51:19 UTC up to this check. Traffic is set to 100% on the latest revision, and no newer revision exists. So `cpms-00007-7r8` (commit `b6cffa1`, confirmed by `/api/health`) served 100% of traffic for the whole of StudyTrack's UAT runs (18–20 Nov 2026), and for the Lab 5 grading baseline.
