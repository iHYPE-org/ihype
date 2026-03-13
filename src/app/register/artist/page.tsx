import { RegisterForm } from '@/components/RegisterForm';

export const metadata = {
  title: 'Artist Sign Up | iHYPE.org',
  description: 'Create an artist account and review the iHYPE artist upload and limited use license policy.'
};

export default function ArtistRegisterPage() {
  return (
    <RegisterForm
      defaultRole="ARTIST"
      intro="Artist accounts can upload media that promoters may curate into streaming-only iHYPE shows. Review and accept the limited-use license policy below before creating your account."
      lockedRole
      title="Artist sign up"
    />
  );
}
