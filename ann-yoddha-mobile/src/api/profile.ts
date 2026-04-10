import { getMe } from './auth';

export async function getProfile(token: string) {
  const user = await getMe(token);
  return {
    farmer_id: String(user.id),
    user_id: String(user.id),
    name: user.name || user.email.split('@')[0],
    phone: user.phone || '-',
    region: user.region || '-',
    language: 'en',
    email: user.email,
    role: user.role,
  };
}

