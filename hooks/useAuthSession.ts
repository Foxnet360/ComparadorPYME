import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import type { UserProfile } from '../types';

interface AuthSessionCallbacks {
  onLogin: () => void;
  onLogout: () => void;
}

/** Bridges the authService-backed session state from AuthContext with the
 * login/logout navigation of the app shell. */
export const useAuthSession = ({ onLogin, onLogout }: AuthSessionCallbacks) => {
  const { currentUser, bootstrapped, login, logout, updateUser } = useAuth();
  const { setShowProfile } = useUI();

  const handleLogin = (user: UserProfile) => {
    login(user);
    onLogin();
  };

  const handleSessionLogout = () => {
    logout();
    onLogout();
    setShowProfile(false);
  };

  return {
    currentUser,
    bootstrapped,
    updateUser,
    handleLogin,
    handleSessionLogout,
  };
};
