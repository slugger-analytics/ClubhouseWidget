// Authentication context for ClubhouseWidget.
// Uses cookie-based auth - the SLUGGER session cookie is automatically sent with all requests.
// Widget runs on same domain as SLUGGER, so cookies are shared seamlessly.
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, userApi, UserWithData } from '../services/api-lambda';

interface AuthContextType {
  user: User | null;
  userData: UserWithData | null;
  loading: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserWithData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current user on mount - cookie is sent automatically
  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      setLoading(true);
      // Cookie auth - the accessToken cookie is sent automatically by the browser
      // Lambda validates the JWT and returns user data (auto-creates if not found)
      const currentUserData = await userApi.getCurrentUserWithData();
      setUser(currentUserData);
      setUserData(currentUserData);
    } catch (error) {
      console.error('Failed to load current user:', error);
      setUser(null);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      const fullUserData = await userApi.getUserWithData(user.id);
      setUserData(fullUserData);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
