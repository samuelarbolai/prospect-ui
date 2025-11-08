import React from 'react';

interface SessionTotalDisplayProps {
  currentTotal: number;
  sessionId: string;
}

export function SessionTotalDisplay({ currentTotal, sessionId }: SessionTotalDisplayProps) {
  const safeTotal = currentTotal || 0;
  const safeSessionId = sessionId || 'unknown';
  
  return (
    <div className="session-total-display">
      <div className="session-info">
        <span className="session-label">Current Session Total:</span>
        <span className="session-amount">${safeTotal.toFixed(2)}</span>
      </div>
      <div className="session-id">
        Session: {safeSessionId.slice(0, 8)}...
      </div>
    </div>
  );
}
