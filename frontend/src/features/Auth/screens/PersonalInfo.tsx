import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/signup', { replace: true }); }, [navigate]);
  return null;
};
