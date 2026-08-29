import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { sanitizeCallbackUrl } from '@/lib/callbackUrl.mjs';
import { getTrustedApplicationOrigin } from '@/lib/server/trustedOrigin.mjs';
import LoginClient from './LoginClient';

function getRawCallbackUrl(searchParams) {
  return Array.isArray(searchParams?.callbackUrl)
    ? searchParams.callbackUrl[0]
    : searchParams?.callbackUrl;
}

export default async function LoginPage({ searchParams }) {
  const trustedOrigin = getTrustedApplicationOrigin();
  const rawCallbackUrl = getRawCallbackUrl(searchParams);
  const callbackUrl = sanitizeCallbackUrl(
    rawCallbackUrl,
    trustedOrigin,
    '/'
  );
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(callbackUrl);
  }

  // Not logged in → render client login UI
  return <LoginClient callbackUrl={callbackUrl} />;
}
