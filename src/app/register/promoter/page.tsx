import { RegisterForm } from '@/components/RegisterForm';

export const metadata = {
  title: 'Promoter Sign Up | iHYPE.org',
  description: 'Create a promoter account and review the iHYPE artist upload and limited use license policy.'
};

export default function PromoterRegisterPage() {
  return (
    <RegisterForm
      defaultRole="DJ"
      intro="Promoter accounts can curate artist uploads into streaming-only iHYPE shows, so the artist upload and limited use license policy applies here too. Review and accept it before creating your account."
      lockedRole
      title="Promoter sign up"
    />
  );
}
