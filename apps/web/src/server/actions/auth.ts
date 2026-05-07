'use server';
import { signIn, signOut } from '@/auth';

export async function signInWithGoogle(redirectTo?: string) {
  await signIn('google', { redirectTo: redirectTo ?? '/app' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
