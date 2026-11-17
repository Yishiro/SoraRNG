import AuthScreen from '../../../src/components/auth-screen';
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <AuthScreen error={error} />;
}
