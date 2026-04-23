import React, { createContext, useContext } from 'react';
import { useBehavioralSentinel } from '../hooks/useBehavioralSentinel';

const BehavioralContext = createContext();

export const BehavioralProvider = ({ children }) => {
  const behavioralData = useBehavioralSentinel();

  return (
    <BehavioralContext.Provider value={behavioralData}>
      {children}
    </BehavioralContext.Provider>
  );
};

export const useBehavioral = () => {
  const context = useContext(BehavioralContext);
  if (!context) {
    throw new Error('useBehavioral must be used within a BehavioralProvider');
  }
  return context;
};
