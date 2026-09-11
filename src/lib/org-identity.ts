/**
 * WHO iHYPE IS AS A LEGAL ENTITY — one source, read by every public surface.
 *
 * WHY THIS EXISTS. The landing footer has claimed "A 501(c)(3) nonprofit"
 * since it was written, and nothing anywhere in the product backed that claim
 * with a name, an EIN or an address. Google for Nonprofits will not approve an
 * organisation whose own website does not publish those, and it is the same
 * information a donor, a venue's finance office or a state charity registry
 * asks for. A claim of tax status with nothing behind it is the defect; the
 * fix is to publish the identity, not to soften the claim.
 *
 * **The reviewer's URL must be PUBLIC.** The signed-in shell renders this at
 * `/app/me/info/transparency`, which is behind auth — a reviewer, a crawler
 * and a regulator all get bounced to sign-in there, so it can never satisfy
 * anyone outside the product. `https://ihype.org/transparency` and
 * `/info?tab=transparency` are the addresses that count, and they render this
 * same block from this same module. Do not let the two drift.
 *
 * **A null is "not published yet", never a placeholder.** Every field is
 * rendered only when it holds a real value, so an unconfigured EIN shows
 * nothing rather than an invented number: a wrong EIN on a public page is
 * materially worse than an absent one, because it is a false statement about a
 * tax status somebody can check. Do not fill these from memory, from an
 * example in a document, or from anything but the IRS determination letter and
 * the registered address on it.
 */

export type PostalAddress = {
  /** Street line, or a PO box / registered-agent line. */
  line1: string;
  /** Suite, unit, floor. */
  line2?: string;
  city: string;
  /** Two-letter US state code. */
  region: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
};

export type OrgIdentity = {
  /** The name on the IRS determination letter, which need not be the brand. */
  legalName: string | null;
  /** The brand, which is what members read everywhere else. */
  displayName: string;
  /** US Employer Identification Number, `NN-NNNNNNN`. */
  ein: string | null;
  /** Federal tax status as determined, stated plainly. */
  taxStatus: string;
  /** The registered address. */
  address: PostalAddress | null;
  /** The one address this product uses for contact (see CLAUDE.md). */
  contactEmail: string;
  /** Published so a funder or a registry has a second way to reach a human. */
  phone: string | null;
  /** The one domain this product may name. */
  website: string;
  /** Where and when, as the charter states it. */
  foundedIn: string;
  foundedYear: number;
};

export const ORG_IDENTITY: OrgIdentity = {
  // Supplied by the owner 2026-09-11. The registered address is in SOUTH
  // Portland; `foundedIn` stays Portland, Maine, because that is where the
  // charter says the organisation was founded and the two are different
  // municipalities — not a typo in either direction.
  //
  // The owner gave the identifier under the label "Charity ID", and when asked
  // whether it was the federal EIN or a state charity registration answered
  // "same for Maine" — one number serving both. It is published as the EIN and
  // ONLY as the EIN: that is the federal term, it is the shape of one (`42` is
  // a valid prefix), and it is what Google for Nonprofits and TechSoup ask a US
  // organisation for. A second row claiming a Maine registration would be its
  // own assertion about a state filing, and nothing here can check that one.
  legalName: 'iHYPE',
  ein: '42-2162562',
  address: {
    line1: '443 Western Ave.',
    line2: '#1176',
    city: 'South Portland',
    region: 'ME',
    postalCode: '04106',
    country: 'US',
  },

  displayName: 'iHYPE',
  taxStatus: '501(c)(3) nonprofit',
  contactEmail: 'admin@ihype.org',
  phone: '(207) 400-7782',
  website: 'https://ihype.org',
  foundedIn: 'Portland, Maine',
  foundedYear: 2026,
};

/**
 * Whether the public identity is complete enough to satisfy a reviewer who
 * asks "who runs this site?".
 *
 * This is deliberately NOT wired to a gate that fails a build or hides the
 * section: the rest of the block (status, contact, where and when) is true and
 * useful on its own, and going dark while a value is missing would leave the
 * page saying less than it can. It exists so an operator surface can say the
 * identity is incomplete rather than leaving it to be noticed by a rejection
 * letter.
 */
export function isPublicIdentityComplete(org: OrgIdentity = ORG_IDENTITY): boolean {
  return Boolean(org.legalName && org.ein && org.address);
}

/** `12-3456789` shape. Used to refuse a value that is clearly not an EIN. */
export const EIN_PATTERN = /^\d{2}-\d{7}$/;

/** One-line rendering of the registered address, for meta tags and emails. */
export function formatAddress(address: PostalAddress | null): string | null {
  if (!address) return null;
  const street = [address.line1, address.line2].filter(Boolean).join(', ');
  return `${street}, ${address.city}, ${address.region} ${address.postalCode}, ${address.country}`;
}
