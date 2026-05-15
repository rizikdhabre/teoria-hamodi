import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

function getSafeCallbackUrl(searchParams) {
  const callbackUrl = Array.isArray(searchParams?.callbackUrl)
    ? searchParams.callbackUrl[0]
    : searchParams?.callbackUrl;

  if (typeof callbackUrl === 'string' && callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  return '/';
}

export default async function LoginPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(getSafeCallbackUrl(searchParams));
  }

  // Not logged in → render client login UI
  return <LoginClient />;
}
