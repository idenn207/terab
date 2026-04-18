import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;

    App.addListener('appUrlOpen', (event) => {
      const url = new URL(event.url);
      navigate(url.pathname);
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
    };
  }, [navigate]);
}
