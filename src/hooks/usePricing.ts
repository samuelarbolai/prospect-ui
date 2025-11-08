import { useState, useEffect } from 'react';

interface PricingSession {
  session_id: string;
  user_id: string;
  current_total: number;
  status: 'active' | 'completed';
}

export function usePricing(apiBase: string) {
  const [currentSession, setCurrentSession] = useState<PricingSession | null>(null);
  const [loading, setLoading] = useState(false);

  const ensureActiveSession = async (): Promise<string | null> => {
    try {
      setLoading(true);
      
      // First check if we already have an active session
      if (currentSession && currentSession.status === 'active') {
        return currentSession.session_id;
      }
      
      // Try to get existing session from backend
      const existingResponse = await fetch(`${apiBase}/api/pricing/sessions/current/global_user`);
      if (existingResponse.ok) {
        const data = await existingResponse.json();
        if (data.session && data.session.status === 'active') {
          setCurrentSession(data.session);
          return data.session.session_id;
        }
      }
      
      // No active session found, create a new one
      const response = await fetch(`${apiBase}/api/pricing/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'global_user' })
      });
      
      if (!response.ok) throw new Error('Failed to start session');
      
      const session = await response.json();
      setCurrentSession(session);
      return session.session_id;
    } catch (error) {
      console.error('Failed to ensure active session:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getCurrentSession = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/api/pricing/sessions/current/global_user`);
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
      } else {
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Failed to get current session:', error);
      setCurrentSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCurrentSession();
  }, [apiBase]);

  return {
    currentSession,
    loading,
    ensureActiveSession,
    getCurrentSession
  };
}
