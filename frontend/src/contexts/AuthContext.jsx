import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import {
  getCurrentUser,
  signIn,
  signOut,
  confirmSignIn,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';
import awsExports from '../config/aws-exports';

Amplify.configure(awsExports);

const AuthContext = createContext(null);

async function buildUser() {
  const cognitoUser = await getCurrentUser();
  const session      = await fetchAuthSession({ forceRefresh: false });
  const accessToken  = session.tokens?.accessToken;
  const groups       = accessToken?.payload['cognito:groups'] || [];

  let role = 'employee';
  if (groups.includes('admin'))   role = 'admin';
  else if (groups.includes('manager')) role = 'manager';

  return {
    username:    cognitoUser.username,
    sub:         cognitoUser.userId,
    email:       cognitoUser.signInDetails?.loginId || accessToken?.payload?.email || '',
    groups,
    role,
    accessToken: accessToken?.toString(),
  };
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaUser, setMfaUser] = useState(null); // intermediate state for new-password challenge

  const loadUser = useCallback(async () => {
    try {
      setUser(await buildUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  async function login(email, password) {
    const result = await signIn({ username: email, password });
    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setMfaUser({ email });
      return { needsNewPassword: true };
    }
    await loadUser();
    return { ok: true };
  }

  async function completeNewPassword(newPassword) {
    await confirmSignIn({ challengeResponse: newPassword });
    setMfaUser(null);
    await loadUser();
  }

  async function logout() {
    await signOut();
    setUser(null);
  }

  async function getToken() {
    const session = await fetchAuthSession({ forceRefresh: false });
    return session.tokens?.accessToken?.toString() || '';
  }

  return (
    <AuthContext.Provider value={{ user, loading, mfaUser, login, logout, completeNewPassword, getToken, reload: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
