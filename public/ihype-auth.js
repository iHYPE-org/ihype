document.querySelectorAll('.otp-input').forEach((input, index, inputs) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(-1);
    if (input.value.length >= 1) {
      input.classList.add('filled');
      if (inputs[index + 1]) inputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && inputs[index - 1]) {
      inputs[index - 1].focus();
      inputs[index - 1].value = '';
      inputs[index - 1].classList.remove('filled');
    }
  });

  input.addEventListener('paste', (event) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

    digits.split('').forEach((digit, offset) => {
      const target = inputs[index + offset];
      if (target) {
        target.value = digit;
        target.classList.add('filled');
      }
    });

    const next = inputs[Math.min(index + digits.length, inputs.length - 1)];
    if (next) next.focus();
  });
});

let challengeId = null;
let lastIdentifier = null;
let lastPassword   = null;
let resendTimer    = null;

function setButtonState(id, text, disabled) {
  const button = document.getElementById(id);
  if (!button) return;
  button.textContent = text;
  button.disabled = disabled;
}

function showError(id, message) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.style.display = message ? 'block' : 'none';
}

function showSuccess(id, message) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.style.display = message ? 'block' : 'none';
  element.style.color = 'var(--r-venue, #22e5d4)';
}

/* ── Resend countdown ─────────────────────────────────────────── */
const RESEND_COOLDOWN = 60; // seconds

function startResendCountdown() {
  const btn = document.getElementById('otp-resend');
  if (!btn) return;

  btn.disabled = true;
  if (resendTimer) clearInterval(resendTimer);

  let remaining = RESEND_COOLDOWN;
  btn.textContent = `Resend in 0:${String(remaining).padStart(2, '0')}`;

  resendTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;
      btn.textContent = "Didn't get it? Resend code →";
      btn.disabled = false;
    } else {
      btn.textContent = `Resend in 0:${String(remaining).padStart(2, '0')}`;
    }
  }, 1000);
}

function stopResendCountdown() {
  if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
  const btn = document.getElementById('otp-resend');
  if (btn) { btn.disabled = true; btn.textContent = 'Resend in 0:60'; }
}

/* ── OTP step visibility ──────────────────────────────────────── */
function showOtpStep(email) {
  document.getElementById('otp-section').style.display = '';
  document.getElementById('otp-email-label').textContent = email;
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('otp-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('otp-0').focus();
  showError('otp-error', '');
  startResendCountdown();
}

function resetToForms() {
  challengeId = null;
  stopResendCountdown();
  document.getElementById('otp-section').style.display = 'none';
  document.getElementById('auth-section').style.display = '';
  document.querySelectorAll('.otp-input').forEach((input) => {
    input.value = '';
    input.classList.remove('filled');
  });
  showError('otp-error', '');
}

function clearOtpInputs() {
  document.querySelectorAll('.otp-input').forEach((input) => {
    input.value = '';
    input.classList.remove('filled');
  });
  document.getElementById('otp-0')?.focus();
}

function isMediaRole(role) {
  return role === 'ARTIST' || role === 'DJ';
}

/* ── API calls ────────────────────────────────────────────────── */
async function requestOtp(identifier, password) {
  const response = await fetch('/api/auth/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to send code.');
  }

  return data;
}

/* ── Resend ───────────────────────────────────────────────────── */
async function handleResend() {
  if (!lastIdentifier || !lastPassword) {
    showError('otp-error', 'Session lost — go back and sign in again.');
    return;
  }

  const btn = document.getElementById('otp-resend');
  const prevText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  showError('otp-error', '');

  try {
    const data = await requestOtp(lastIdentifier, lastPassword);
    challengeId = data.challengeId;
    clearOtpInputs();
    showSuccess('otp-error', '✓ New code sent — check your inbox.');
    startResendCountdown();
  } catch (error) {
    if (btn) { btn.disabled = false; btn.textContent = prevText || "Resend code →"; }
    const msg = error instanceof Error ? error.message : 'Failed to resend.';
    // Rate limit message is already user-friendly from the API
    showError('otp-error', msg);
  }
}

/* ── Sign up ──────────────────────────────────────────────────── */
async function handleSignUp() {
  const email = document.getElementById('su-email').value.trim();
  const username = document.getElementById('su-username').value.trim();
  const role = document.getElementById('su-role').value;
  const password = document.getElementById('su-password').value;
  const acceptedPolicy = document.getElementById('su-age-policy').checked;

  showError('su-error', '');

  if (!email || !username || !role || !password) {
    showError('su-error', 'Please fill in all fields.');
    return;
  }

  if (!acceptedPolicy) {
    showError('su-error', 'Please confirm the age and content attestation.');
    return;
  }

  setButtonState('su-btn', 'Creating account...', true);

  try {
    const registerResponse = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password,
        role,
        isThirteenOrOlder: acceptedPolicy,
        acceptedArtistUploadPolicy: isMediaRole(role) ? acceptedPolicy : false
      })
    });
    const registerData = await registerResponse.json();

    if (!registerResponse.ok) {
      throw new Error(registerData.error || 'Registration failed.');
    }

    const data = await requestOtp(email, password);
    challengeId = data.challengeId;
    lastIdentifier = email;
    lastPassword   = password;
    showOtpStep(data.email);
  } catch (error) {
    showError('su-error', error instanceof Error ? error.message : 'Registration failed.');
  } finally {
    setButtonState('su-btn', 'Create account and send code', false);
  }
}

/* ── Sign in ──────────────────────────────────────────────────── */
async function handleSignIn() {
  const identifier = document.getElementById('si-identifier').value.trim();
  const password = document.getElementById('si-password').value;

  showError('si-error', '');

  if (!identifier || !password) {
    showError('si-error', 'Please fill in all fields.');
    return;
  }

  setButtonState('si-btn', 'Sending code...', true);

  try {
    const data = await requestOtp(identifier, password);
    challengeId = data.challengeId;
    lastIdentifier = identifier;
    lastPassword   = password;
    showOtpStep(data.email);
  } catch (error) {
    showError('si-error', error instanceof Error ? error.message : 'Failed to send code.');
  } finally {
    setButtonState('si-btn', 'Send my code', false);
  }
}

/* ── Verify ───────────────────────────────────────────────────── */
async function handleVerify() {
  const otp = [0, 1, 2, 3, 4, 5].map((index) => document.getElementById(`otp-${index}`).value).join('');

  showError('otp-error', '');

  if (otp.length < 6) {
    showError('otp-error', 'Enter all 6 digits.');
    return;
  }

  if (!challengeId) {
    showError('otp-error', 'Session expired — use the Resend button to get a fresh code.');
    return;
  }

  setButtonState('otp-btn', 'Verifying...', true);

  try {
    const response = await fetch('/api/auth/otp/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, otp })
    });
    const data = await response.json();

    if (!response.ok) {
      // Surface a helpful message depending on what went wrong
      let msg = data.error || 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('expir')) {
        msg = 'Code expired — tap "Resend code" below to get a new one.';
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('incorrect')) {
        msg = 'Incorrect code — double-check and try again, or resend.';
      }
      showError('otp-error', msg);
      setButtonState('otp-btn', 'Verify and continue', false);
      return;
    }

    window.location.href = data.redirect || '/auth/landing';
  } catch {
    showError('otp-error', 'Something went wrong. Please try again.');
    setButtonState('otp-btn', 'Verify and continue', false);
  }
}

/* ── Initial error from URL ───────────────────────────────────── */
function showInitialAuthErrors() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  if (error === 'CredentialsSignin') {
    showError('si-error', 'Incorrect code or it expired. Enter your password again to get a new code.');
  } else if (error) {
    showError('si-error', `Sign-in error: ${error}. Please try again.`);
  }
}

/* ── Event wiring ─────────────────────────────────────────────── */
document.getElementById('su-password')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleSignUp();
});
document.getElementById('si-password')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleSignIn();
});
document.getElementById('otp-5')?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleVerify();
});
document.getElementById('su-btn')?.addEventListener('click', handleSignUp);
document.getElementById('si-btn')?.addEventListener('click', handleSignIn);
document.getElementById('otp-btn')?.addEventListener('click', handleVerify);
document.getElementById('otp-resend')?.addEventListener('click', handleResend);
document.getElementById('otp-back')?.addEventListener('click', (event) => {
  event.preventDefault();
  resetToForms();
});

showInitialAuthErrors();
