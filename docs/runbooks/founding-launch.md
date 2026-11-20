# iHYPE founding launch

Run the first launch with two staff. Publishing, listening and access are free.
Music-related radio-style advertising is the only paid service.

## Founding creators

- Creator lead: shortlist 3–5 local artists and 1–2 venues in Greater Portland.
  Use the founding artist and venue outreach templates in
  [the launch kit](../rapid-reach-launch-kit.md). Send invitations from the
  normal iHYPE account and track consent before publishing any material.
- Ask each participant for one usable item: a rights-cleared track or clip,
  or one real event listing, plus a short bio and an approved image. Pair
  with the creator to complete verification, preview the page on a phone,
  and publish it. Record the public URL and any onboarding blockers.
- Publish the first cohort before expanding outreach. Review published pages,
  first plays and reports at the end of launch week.

## Operating budget

- Operations lead: record one monthly USD ceiling and each provider's
  committed, invoiced and projected costs for Mux, Cloudflare, database,
  and email. Track credits separately with expiration dates and review weekly.
- Start with alerts at 50%, 75%, and 90% of the approved ceiling where supported.
  At 75%, review projected usage and defer discretionary spend. At 90%, pause
  new video uploads if projected usage threatens the ceiling. Review retained
  minutes and playback separately. Existing delivery and storage can still
  accrue costs after uploads pause.
- The draft video feature allows 20 upload attempts per UTC month across
  iHYPE. Use 1080p by default, offer 4K by choice, and confirm provider
  settings and billing counters before launch.

## Staff work queue

Use the existing Admin Workbench at `/admin` as the entry point. Follow its
links to verification and content reports. Track failed uploads that need
staff action in the same shared triage list, using profile and video IDs
without credentials or private media URLs.

| Item | Owner | Next action |
| --- | --- | --- |
| Verification | Creator lead | Review proof and record the decision. |
| Rights or safety report | Operations lead | Review content, record the decision and check visibility after action. |
| Failed upload | Creator lead | Confirm processing or cleanup state. Hand provider errors to operations. |

Keep an assignee, status, next action and due date on each item. Review daily
during the launch week and cover for each other.

## First radio-style ad

Sell one staff-managed music-related audio spot format. Capture the advertiser,
approved audio, campaign dates, placement and agreed price in the existing
campaign workflow. Rehearse one test placement, including audio transitions
and the end date. Report dates, delivered plays from available platform
metrics and any make-good. Keep advertiser self-service out of the first
sales workflow until repeat demand justifies it.

## Phone staging rehearsal

Use a verified staging artist and a signed-out listener. Record the tested
commit, device, environment, screenshots, timing, and any provider usage.

1. Submit and approve artist verification, then publish the first page.
2. Upload a rights-cleared Mux test clip. Wait for the signed webhook and verify
   that the video stays private until the artist publishes it.
3. Play the published clip as the listener, then unpublish and verify that
   playback is revoked. Delete it and confirm provider cleanup.
4. Repeat with approved real 1080p and 4K samples before public launch.
   Exercise retry on mobile and verify that another owner cannot manage the
   video. Use the [Mux runbook](profile-sites-mux-4k.md) for credential rotation
   and cost checks.
