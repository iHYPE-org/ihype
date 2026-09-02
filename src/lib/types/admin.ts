export type VerificationProfile = {
  id: string;
  slug: string;
  hexId: string;
  name: string;
  type: string;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  contactInfo: string | null;
  verificationNotes: string | null;
  /** A proof document is attached; open it via /api/admin/verifications/[id]/proof. */
  hasProof?: boolean;
  verificationStatus: string;
  verificationSubmittedAt: Date | string | null;
  verificationReviewedAt: Date | string | null;
  hypeCount: number;
  owner: {
    id: string;
    email: string | null;
    name: string | null;
    username: string;
    createdAt: Date | string;
  };
};
