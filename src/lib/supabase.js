// ═══════════════════════════════════════════
// Supabase Client Configuration
// ═══════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase 환경 변수가 설정되지 않았습니다. 오프라인 모드로 실행합니다.');
  // 환경변수 없을 때 앱 크래시 방지용 noop client
  const noop = () => Promise.resolve({ data: null, error: null });
  const noopAuth = {
    signInWithOAuth: noop, signOut: noop,
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    setSession: noop,
  };
  supabase = { auth: noopAuth, from: () => ({ select: noop, insert: noop, delete: noop, upsert: noop }) };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// ─── Deep Link Listener (Capacitor) ───

if (Capacitor.isNativePlatform()) {
  App.addListener('appUrlOpen', async ({ url }) => {
    // OAuth 콜백: kr.pillstack://#access_token=...
    if (url.includes('access_token') && url.includes('refresh_token')) {
      // URL fragment에서 토큰 추출
      const hashPart = url.split('#')[1];
      if (hashPart) {
        const params = new URLSearchParams(hashPart);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
      // 인앱 브라우저 닫기
      try { await Browser.close(); } catch (e) {}
    }
  });
}

// ─── Auth Helpers ───

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    // 네이티브: 인앱 브라우저 사용
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://pillstack.kr/auth-callback.html',
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (data?.url) {
      await Browser.open({ url: data.url });
    }
    return data;
  } else {
    // 웹: 기존 방식
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  }
}

export async function signInWithKakao() {
  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        scopes: 'profile_nickname account_email',
        redirectTo: 'https://pillstack.kr/auth-callback.html',
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (data?.url) {
      await Browser.open({ url: data.url });
    }
    return data;
  } else {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        scopes: 'profile_nickname account_email',
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

