import { Auth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

declare global {
  interface Window {
    __IS_NATIVE_IOS_GOOGLE_WRAPPER?: boolean;
    webkit?: {
      messageHandlers?: {
        nativeAuth?: {
          postMessage: (payload: unknown) => void;
        };
      };
    };
    __completeNativeGoogleSignIn?: (payload: { idToken: string; accessToken: string }) => void;
    __nativeGoogleAuthError?: (message: string) => void;
  }
}

export function isNativeIosGoogleWrapper(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasBridge =
    !!window.webkit?.messageHandlers?.nativeAuth &&
    (
      !!window.__IS_NATIVE_IOS_GOOGLE_WRAPPER ||
      new URLSearchParams(window.location.search).get('ios_wrapper') === '1' ||
      window.navigator.userAgent.includes('EducationRevWrapper/1.0') ||
      window.navigator.userAgent.includes('EduRevolutionAIWrapper/1.0')
    );

  return hasBridge;
}

export function requestNativeGoogleSignIn() {
  if (!isNativeIosGoogleWrapper()) {
    throw new Error('Native iOS Google sign-in is not available in this environment.');
  }

  window.webkit!.messageHandlers!.nativeAuth!.postMessage({ provider: 'google' });
}

export function bindNativeGoogleSignInBridge(
  auth: Auth,
  options: {
    onSuccess?: () => void;
    onError?: (message: string) => void;
  },
) {
  if (!isNativeIosGoogleWrapper()) {
    return () => undefined;
  }

  window.__completeNativeGoogleSignIn = async ({ idToken, accessToken }) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      await signInWithCredential(auth, credential);
      options.onSuccess?.();
    } catch (error: any) {
      options.onError?.(error?.message || 'Native Google sign-in failed.');
    }
  };

  window.__nativeGoogleAuthError = (message: string) => {
    options.onError?.(message || 'Native Google sign-in failed.');
  };

  return () => {
    delete window.__completeNativeGoogleSignIn;
    delete window.__nativeGoogleAuthError;
  };
}
