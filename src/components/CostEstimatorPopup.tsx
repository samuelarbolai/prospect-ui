import React, { useState, useEffect } from 'react';

interface CostEstimatorPopupProps {
  isOpen: boolean;
  prospectIds: string[];
  onCancel: () => void;
  onEnrich: () => void;
  apiBase: string;
}

export function CostEstimatorPopup({ 
  isOpen, 
  prospectIds, 
  onCancel, 
  onEnrich, 
  apiBase 
}: CostEstimatorPopupProps) {
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && prospectIds.length > 0) {
      fetchEstimate();
    }
  }, [isOpen, prospectIds]);

  const fetchEstimate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/api/pricing/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds })
      });
      
      if (response.ok) {
        const data = await response.json();
        setEstimatedCost(data.estimatedCost);
      }
    } catch (error) {
      console.error('Failed to fetch cost estimate:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="cost-estimator-popup">
        <h3>Domain Enrichment Cost Estimate</h3>
        
        <div className="cost-details">
          <p><strong>Prospects to enrich:</strong> {prospectIds.length}</p>
          <p><strong>Cost per prospect:</strong> $0.10</p>
          <p><strong>Estimated total:</strong> ${loading ? '...' : estimatedCost.toFixed(2)}</p>
        </div>

        <div className="popup-actions">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onEnrich} className="btn-primary" disabled={loading}>
            Proceed with Enrichment
          </button>
        </div>
      </div>
    </div>
  );
}
