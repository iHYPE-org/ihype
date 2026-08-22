/* The one show the console templates demonstrate, and the routes between them.
   Checkout, the ticket, the venue profile and the artist profile all describe
   the SAME night, so the facts live here rather than being retyped in four
   logic classes where they drift the moment one is edited.

   Loaded as a classic script from each template's <helmet>, so it is available
   synchronously by the time a logic class first renders. */
window.IHYPE_DEMO = {
  show: {
    slug: 'thompsons-pt-aug21',
    act: 'Second Shift · Cold Cellar',
    headliner: 'Second Shift',
    support: 'Cold Cellar',
    when: 'Tonight · 7:30 PM',
    doors: 'Doors 7, first act 7:30, hard curfew 11',
    /* Cents, and the only price in the system. Every figure any screen shows —
       face value, Stripe's processing, the 70/20/10 amounts — is derived from
       this one number, so no two screens can quote different money. */
    faceCents: 1200,
    seat: 'GA',
  },
  venue: {
    slug: 'thompsons-point',
    name: 'Thompson’s Point',
    short: 'Thompson’s Pt',
    room: 'Converted freight shed · concrete floor',
    capacity: '400 standing, 220 seated',
    address: '10 Thompson’s Point Rd, Portland ME',
    zip: '04102',
  },
  artist: {
    slug: 'deering-oaks',
    name: 'Deering Oaks',
    genre: 'Dream-pop · Brass',
    city: 'Portland, ME',
  },
  ticket: {
    code: 'IH-4K7Q-22',
    order: 'CNF-8J41',
    holder: 'jrs_pdx',
  },
  /* Stripe's own charge, stated separately from iHYPE's $0 wherever money is
     shown. The flat fee is per TRANSACTION, not per ticket. */
  stripe: { pct: 0.029, amexPct: 0.035, flatCents: 30 },
  routes: {
    MAP: '../console-shell/ConsoleShell.dc.html',
    MUSIC: '../console-shell/ConsoleShell.dc.html',
    ME: '../console-settings/ConsoleSettings.dc.html',
    shell: '../console-shell/ConsoleShell.dc.html',
    checkout: '../console-checkout/ConsoleCheckout.dc.html',
    ticket: '../console-ticket/ConsoleTicket.dc.html',
    profile: '../console-profile/ConsoleProfile.dc.html',
    settings: '../console-settings/ConsoleSettings.dc.html',
    info: '../console-info/ConsoleInfo.dc.html',
    Profiles: '../console-profile/ConsoleProfile.dc.html',
    Tickets: '../console-ticket/ConsoleTicket.dc.html',
    Info: '../console-info/ConsoleInfo.dc.html',
    Settings: '../console-settings/ConsoleSettings.dc.html',
  },
};

/* Face value, Stripe's cut and the total for a given quantity — one function,
   so a screen cannot round it differently. */
window.IHYPE_DEMO.price = function (qty, amex) {
  const d = window.IHYPE_DEMO;
  const face = d.show.faceCents * qty;
  const processing = Math.round(face * (amex ? d.stripe.amexPct : d.stripe.pct)) + d.stripe.flatCents;
  return { face: face, processing: processing, total: face + processing };
};

window.IHYPE_DEMO.money = function (cents) {
  return '$' + (cents / 100).toFixed(2);
};
