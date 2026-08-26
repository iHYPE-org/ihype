# CI on our own runner (Azure)

**Why:** the org's GitHub Actions allowance ran out and jobs were being
cancelled mid-run. The response was to gate about 11 of CI's 15 minutes — the
browser, Cloudflare and Lighthouse stages — behind a diff check, so most pushes
verify less than they used to. **Minutes on a self-hosted runner are free**, so
this machine exists to buy that coverage back, not to save a line item.

**Funded by** a $2,000 Azure nonprofit grant (2026-08-25). Credits expire, so
nothing with production data goes on Azure — see "What must not move" below.

---

## 1. Create the VM

Run these in **Azure Cloud Shell** (the `>_` icon in the portal — no local
install, already signed in). Subscription and region are the ones set up for
this: `Azure subscription 1`, `eastus`.

```bash
az account set --subscription dc15b4b4-0277-4147-acb1-124b8d50edf5

az group create --name ihype-ci --location eastus

az vm create \
  --resource-group ihype-ci \
  --name ihype-ci-runner \
  --image Ubuntu2404 \
  --size Standard_D4as_v7 \
  --os-disk-size-gb 128 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --nsg-rule SSH
```

Notes on each choice that is not obvious:

- **Not spot, for now.** Spot is roughly a third the price and was the plan,
  but a new sponsorship subscription is refused spot capacity outright — four
  families in a row returned `SkuNotAvailable`, including on-demand sizes,
  which is how we learned the real cause was the SKU generation (below). Spot
  restrictions usually lift once a subscription has billing history: **revisit
  in a month**, and if it takes, recreate with
  `--priority Spot --eviction-policy Deallocate --max-price -1`. Deallocate
  keeps the disk, so an eviction costs a restart and no re-registration.

  On-demand `D4as_v7` is about $0.19/hour — roughly $140/month at 24/7, or
  ~$95 with the nightly shutdown below. Against a $2,000 grant that is a year
  or more.
- **`D4as_v7`, and the generation is the part that matters.** 4 vCPU / 16GB —
  the build peaks around 3GB (`--max-old-space-size=3072`) and Playwright wants
  real cores. **East US offers new subscriptions only the v7 families**, and
  every v3/v4/v5 size fails with `SkuNotAvailable — Capacity Restrictions`,
  which reads like a transient shortage and is not. Six creates were burned
  guessing sizes before asking Azure what it would actually give:

  ```bash
  az vm list-skus -l eastus --resource-type virtualMachines --all \
    --query '[?length(restrictions)==`0`].name' -o tsv | sort -u | head -40
  ```

  **Run that first whenever a create is refused.** An empty result means the
  region is closed to this subscription; a list means you picked the wrong
  generation.
- **128GB disk.** `node_modules`, `.open-next`, the workerd binary and three
  Playwright browsers do not fit the 30GB default.
- **SSH is the only inbound rule**, and the runner needs *no* inbound at all —
  it polls GitHub outbound. Lock the rule to your own IP once you are done:
  `az network nsg rule update -g ihype-ci --nsg-name ihype-ci-runnerNSG -n default-allow-ssh --source-address-prefixes <your-ip>/32`

If the create fails on quota, request a **spot vCPU quota increase for `Dasv5`
in East US** in the portal. It is usually granted in minutes.

## 2. Register the runner

Get a token: GitHub → the **iHYPE-org** org → Settings → Actions → Runners →
**New self-hosted runner** → Linux. Copy the token from the `./config.sh` line.
**It expires in one hour.**

```bash
az vm run-command invoke -g ihype-ci -n ihype-ci-runner \
  --command-id RunShellScript \
  --scripts "curl -fsSL https://raw.githubusercontent.com/iHYPE-org/ihype/main/scripts/azure-ci-runner-setup.sh | bash -s -- <TOKEN>"
```

…or SSH in (`az ssh vm -g ihype-ci -n ihype-ci-runner`) and run
`scripts/azure-ci-runner-setup.sh <TOKEN>` from a clone. The script installs
Docker (required — `ci.yml` declares a `postgres:16` service container),
Playwright's system libraries, and the runner as a boot service. It does **not**
install Node: the workflow pins its own through `actions/setup-node`, and a
system Node could only disagree with it.

## 3. Point CI at it

**Done on 2026-08-26.** `ci.yml` runs on `[self-hosted, linux, x64, ihype-ci]`,
and the **"Decide the CI depth"** step, the `FULL_CI` variable and the
`full-ci` label override are deleted — every stage runs on every push again.

If the runner is ever rebuilt, do it in that order: **the runner must be online
before `runs-on` points at it.** A job whose labels match no runner does not
fail, it queues silently until someone notices.

**Leave `deploy-production.yml` on `ubuntu-latest`.** It holds the production
secrets, and a self-hosted runner executes whatever a workflow tells it to —
including from a fork's pull request, if repository settings ever allow one.
Keeping deploys on ephemeral GitHub infrastructure keeps that boundary.

## 4. Guard the credits — with a budget, NOT an auto-shutdown

Set a budget the day you create the VM. The CLI's `consumption budget` command
is a fussy preview and rejected a valid request, so do it in the portal:
**Cost Management → Budgets → + Add**, scope the subscription, monthly, **$150**,
alert at 80%.

Azure does **not** stop at zero when a grant runs out — it bills the card on
file. An on-demand `D4as_v7` is about $140/month, so $2,000 covers roughly 14
months, but only if nothing else is provisioned against the same subscription.

**Do NOT set `az vm auto-shutdown` on this VM.** It was tried on the first
night and had to be undone within the hour. There is no matching auto-start:
`az vm auto-shutdown` deallocates on a schedule and nothing brings the machine
back, so the runner goes offline permanently at the first firing. Worse, a job
asking for a runner that does not exist **queues silently** rather than failing
— the same failure mode that cost this setup its first evening — so CI would
appear to hang for no visible reason, at night, with no error anywhere.

The saving was about $45/month. If it is ever worth reclaiming, the correct
shape is a PAIRED start/stop schedule via Azure Automation, so the machine
comes back on its own. A bare shutdown is not a cheaper version of that; it is
a broken one.

## What must not move to Azure

- **R2 (media).** Cloudflare charges no egress; Azure Blob does. Moving it would
  *raise* the bill the day the credits end, on the largest data set we have.
- **Production Postgres.** Hyperdrive, the Supabase advisors and the Stripe Sync
  Engine are all wired to Supabase. A migration would be a cliff in twelve
  months, not a saving.
- **Transcription and vision.** Workers AI already runs inside the same worker.
  The unfunded AI gap is **ACRCloud**, and Azure credits cannot pay for it.

## What Azure *should* also carry: a staging database

`docs/runbooks/money-path-rehearsal.md` is blocked on not having one —
`triggerShowPayouts()`'s state transitions have never executed against a real
Postgres, and the step that matters (run the payout cron twice, see
`released: 0`) cannot be walked without it. A burstable server is enough:

```bash
az postgres flexible-server create \
  --resource-group ihype-staging --name ihype-staging-db --location eastus \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --version 16 --public-access 0.0.0.0
```

Its own resource group, so it can be deleted without touching CI. It holds
scratch data only — never a copy of production.
