#!/usr/bin/env bash
# Bootstraps a self-hosted GitHub Actions runner for iHYPE on a fresh Ubuntu
# 24.04 VM. Run it ON THE VM, as a sudo-capable user, once.
#
#   sudo bash scripts/azure-ci-runner-setup.sh <GITHUB_RUNNER_TOKEN>
#
# WHY THIS EXISTS. The org's Actions allowance ran out and jobs were being
# cancelled mid-run, so CI's browser, Cloudflare and Lighthouse stages were put
# behind a diff check to fit inside it — about 11 of CI's 15 minutes now only
# run when the diff touches certain paths. Minutes on a self-hosted runner are
# free, so the constraint that forced that gating goes away with this machine.
#
# WHAT THE WORKFLOW ACTUALLY NEEDS, and why each line below is here:
#   - Docker. `ci.yml` declares `services: postgres:16`, and service containers
#     on a self-hosted runner are started by the runner's own Docker daemon.
#     Without it every job fails before its first step.
#   - Passwordless sudo for the runner user. `npx playwright install --with-deps`
#     shells out to apt; on a hosted runner that is free, here it is not.
#   - A large disk. node_modules, .open-next, the workerd binary and three
#     Playwright browsers do not fit comfortably in the 30GB default.
#   - Node is NOT installed here on purpose: the workflow pins its own version
#     through actions/setup-node, and a system Node would only ever disagree
#     with it.
set -euo pipefail

TOKEN="${1:-}"
RUNNER_USER="${RUNNER_USER:-ghrunner}"
RUNNER_HOME="/opt/actions-runner"
GITHUB_URL="${GITHUB_URL:-https://github.com/iHYPE-org}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64,ihype-ci}"

if [[ -z "$TOKEN" ]]; then
  echo "usage: sudo bash $0 <GITHUB_RUNNER_TOKEN>" >&2
  echo "  Get the token from GitHub → the iHYPE-org org → Settings → Actions →" >&2
  echo "  Runners → New self-hosted runner. It expires in one hour." >&2
  exit 2
fi
if [[ "$EUID" -ne 0 ]]; then
  echo "run this with sudo" >&2
  exit 2
fi

echo "==> packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# curl/jq to fetch the runner release; git for checkout; docker for the
# postgres service container; the rest are Playwright's own shared libraries,
# installed up front so the first CI run does not spend four minutes on apt.
apt-get install -y -qq \
  curl jq git ca-certificates gnupg unzip \
  docker.io \
  libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2t64

systemctl enable --now docker

echo "==> runner user: $RUNNER_USER"
if ! id -u "$RUNNER_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$RUNNER_USER"
fi
usermod -aG docker "$RUNNER_USER"
# Scoped to apt-get and playwright's dependency installer rather than blanket
# NOPASSWD: the runner executes whatever a workflow tells it to, so the narrower
# this grant is, the less a compromised workflow inherits.
cat > /etc/sudoers.d/90-github-runner <<SUDOERS
$RUNNER_USER ALL=(root) NOPASSWD: /usr/bin/apt-get, /usr/bin/apt, /usr/bin/dpkg
SUDOERS
chmod 0440 /etc/sudoers.d/90-github-runner

echo "==> runner package"
mkdir -p "$RUNNER_HOME"
LATEST="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name)"
VERSION="${LATEST#v}"
curl -fsSL -o /tmp/actions-runner.tar.gz \
  "https://github.com/actions/runner/releases/download/${LATEST}/actions-runner-linux-x64-${VERSION}.tar.gz"
tar xzf /tmp/actions-runner.tar.gz -C "$RUNNER_HOME"
rm -f /tmp/actions-runner.tar.gz
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

echo "==> register"
# --replace so re-running this script after an eviction re-registers the same
# name instead of accumulating dead runners in the org's list.
sudo -u "$RUNNER_USER" -H bash -c "cd '$RUNNER_HOME' && ./config.sh \
  --url '$GITHUB_URL' \
  --token '$TOKEN' \
  --name '$(hostname)' \
  --labels '$RUNNER_LABELS' \
  --work _work \
  --unattended --replace"

echo "==> service"
cd "$RUNNER_HOME"
./svc.sh install "$RUNNER_USER"
./svc.sh start

echo
echo "Runner registered with labels: $RUNNER_LABELS"
echo "It survives reboots. On a spot eviction Azure DEALLOCATES the VM; start it"
echo "again and the service comes back on its own — no re-registration needed."
echo
echo "Next: point ci.yml's runs-on at these labels."
