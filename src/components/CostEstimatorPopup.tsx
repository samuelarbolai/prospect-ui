import React, { useState, useEffect } from 'react';

interface CostEstimatorPopupProps {
  isOpen: boolean;
  prospectIds: string[];
  enrichmentType?: "linkedin" | "domain";
  onCancel: () => void;
  onEnrich: () => void;
  apiBase: string;
}

export function CostEstimatorPopup({ 
  isOpen, 
  prospectIds, 
  enrichmentType = "domain",
  onCancel, 
  onEnrich, 
  apiBase 
}: CostEstimatorPopupProps) {
  const costPerProspect = 0.10;
  const estimatedCost = prospectIds.length * costPerProspect;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="cost-estimator-popup">
        <h3>{enrichmentType === "linkedin" ? "LinkedIn" : "Domain"} Enrichment Cost Estimate</h3>
        
        <div className="cost-details">
          <p><strong>Prospects to enrich:</strong> {prospectIds.length}</p>
          <p><strong>Cost per prospect:</strong> $0.10</p>
          <p><strong>Estimated total:</strong> ${estimatedCost.toFixed(2)}</p>
        </div>

        <div className="popup-actions">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onEnrich} className="btn-primary">
            Proceed with Enrichment
          </button>
        </div>
      </div>
    </div>
  );
}
