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
  --size Standard_D4as_v5 \
  --priority Spot \
  --eviction-policy Deallocate \
  --max-price -1 \
  --os-disk-size-gb 128 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --nsg-rule SSH
```

Notes on each choice that is not obvious:

- **Spot with `Deallocate`.** Roughly a third the price. Azure can reclaim the
  machine at any time; deallocated means the disk survives and starting it again
  brings the runner back with no re-registration. `--max-price -1` means "pay up
  to the normal on-demand price", which in practice means it is almost never
  evicted.
- **`D4as_v5`** — 4 vCPU / 16GB. The build peaks around 3GB (`--max-old-space-size=3072`)
  and Playwright wants real cores. If spot capacity is short in your zone,
  `Standard_D4s_v5` is a fine substitute.
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

Once the runner shows **Idle** in the org's runner list, change `runs-on` in
`.github/workflows/ci.yml` from `ubuntu-latest` to:

```yaml
runs-on: [self-hosted, linux, x64, ihype-ci]
```

**Do this only after the runner is online.** A job whose labels match no runner
does not fail — it queues, silently, until someone notices.

Then remove the diff gating that only existed to fit the allowance: the
**"Decide the CI depth"** step and every `if: env.FULL_CI == 'true'` in
`ci.yml`. That step's own log line explains why it chose what it chose; deleting
it means every push runs every stage again.

**Leave `deploy-production.yml` on `ubuntu-latest`.** It holds the production
secrets, and a self-hosted runner executes whatever a workflow tells it to —
including from a fork's pull request, if repository settings ever allow one.
Keeping deploys on ephemeral GitHub infrastructure keeps that boundary.

## 4. Guard the credits

Set a budget the day you create the VM:

```bash
az consumption budget create \
  --budget-name ihype-ci-monthly --amount 150 --time-grain Monthly \
  --category Cost --start-date $(date -u +%Y-%m-01) --end-date 2027-12-31
```

Azure does **not** stop at zero when a grant runs out — it bills the card on
file. A running spot VM plus a burstable Postgres is roughly $60–90/month, so
$2,000 covers about a year, but only if nothing else is provisioned against the
same subscription.

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
