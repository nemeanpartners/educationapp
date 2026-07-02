import { useEffect, useState } from 'react';

type ResponsiveDevice = {
  width: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

function getResponsiveDevice(): ResponsiveDevice {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      isPhone: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  const width = window.innerWidth;

  return {
    width,
    isPhone: width < 768,
    isTablet: width >= 768 && width < 1180,
    isDesktop: width >= 1180,
  };
}

export function useResponsiveDevice() {
  const [device, setDevice] = useState<ResponsiveDevice>(() => getResponsiveDevice());

  useEffect(() => {
    const handleResize = () => setDevice(getResponsiveDevice());

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return device;
}
