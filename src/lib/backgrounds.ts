import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from '@/lib/portal-firestore';
import { auth, db } from '../firebase';
import { BackgroundPage, PageBackgroundSetting } from '../types';

export const BACKGROUND_COLORS = [
  { id: 'mist', label: 'Soft Mist', value: '#f4f5f7' },
  { id: 'sky', label: 'Study Sky', value: '#e0f2fe' },
  { id: 'mint', label: 'Fresh Mint', value: '#dcfce7' },
  { id: 'blush', label: 'Calm Blush', value: '#ffe4e6' },
  { id: 'lavender', label: 'Lavender', value: '#ede9fe' },
  { id: 'cream', label: 'Warm Cream', value: '#fef3c7' },
];

export const BACKGROUND_CATEGORIES = [
  'Abstract',
  'Light',
  'Nature',
  'Bright',
] as const;

export const BACKGROUND_PRESETS = [
  {
    id: 'neon-soft-pillars',
    label: 'Soft Neon Pillars',
    category: 'Abstract',
    url: '/background-presets/neon-soft-pillars.jpeg',
  },
  {
    id: 'light-speed-tunnel',
    label: 'Light Speed Tunnel',
    category: 'Abstract',
    url: '/background-presets/light-speed-tunnel.jpeg',
  },
  {
    id: 'neon-light-ribbons',
    label: 'Neon Light Ribbons',
    category: 'Abstract',
    url: '/background-presets/neon-light-ribbons.jpeg',
  },
  {
    id: 'digital-rain',
    label: 'Digital Rain',
    category: 'Abstract',
    url: '/background-presets/digital-rain.jpeg',
  },
  {
    id: 'white-gold-tiles',
    label: 'White Gold Tiles',
    category: 'Light',
    url: '/background-presets/white-gold-tiles.jpeg',
  },
  {
    id: 'golden-ribbons',
    label: 'Golden Ribbons',
    category: 'Light',
    url: '/background-presets/golden-ribbons.jpeg',
  },
  {
    id: 'pastel-paint-splash',
    label: 'Pastel Paint Splash',
    category: 'Bright',
    url: '/background-presets/pastel-paint-splash.jpeg',
  },
  {
    id: 'pastel-water-drops',
    label: 'Pastel Water Drops',
    category: 'Light',
    url: '/background-presets/pastel-water-drops.jpeg',
  },
  {
    id: 'pink-flower',
    label: 'Pink Flower',
    category: 'Nature',
    url: '/background-presets/pink-flower.jpeg',
  },
  {
    id: 'citrus-bubbles',
    label: 'Citrus Bubbles',
    category: 'Bright',
    url: '/background-presets/citrus-bubbles.jpeg',
  },
  {
    id: 'tropical-colour',
    label: 'Tropical Colour',
    category: 'Nature',
    url: '/background-presets/tropical-colour.jpeg',
  },
  {
    id: 'orange-glass',
    label: 'Orange Glass',
    category: 'Light',
    url: '/background-presets/orange-glass.jpeg',
  },
  {
    id: 'prismatic-folds',
    label: 'Prismatic Folds',
    category: 'Abstract',
    url: '/background-presets/prismatic-folds.jpeg',
  },
  {
    id: 'soft-aurora',
    label: 'Soft Aurora',
    category: 'Light',
    url: '/background-presets/soft-aurora.jpeg',
  },
  {
    id: 'sunset-strata',
    label: 'Sunset Strata',
    category: 'Bright',
    url: '/background-presets/IMG_9744.jpg',
  },
  {
    id: 'aqua-horizon',
    label: 'Aqua Horizon',
    category: 'Nature',
    url: '/background-presets/IMG_9743.jpg',
  },
  {
    id: 'silver-tide',
    label: 'Silver Tide',
    category: 'Light',
    url: '/background-presets/IMG_9742.jpg',
  },
  {
    id: 'ember-wave',
    label: 'Ember Wave',
    category: 'Bright',
    url: '/background-presets/IMG_9741.jpg',
  },
] satisfies Array<{
  id: string;
  label: string;
  category: typeof BACKGROUND_CATEGORIES[number];
  url: string;
}>;

export const DEFAULT_BACKGROUND: PageBackgroundSetting = { mode: 'default' };

export function getBackgroundStyle(setting?: PageBackgroundSetting): CSSProperties {
  if (!setting || setting.mode === 'default') {
    return {};
  }

  if (setting.mode === 'color' && setting.color) {
    return { backgroundColor: setting.color };
  }

  return {};
}

export function getBackgroundImageLayerStyle(setting?: PageBackgroundSetting): CSSProperties {
  if ((setting?.mode === 'preset' || setting?.mode === 'custom') && setting.url) {
    return {
      backgroundImage: `url("${setting.url}")`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    };
  }

  return {};
}

export function hasBackgroundImage(setting?: PageBackgroundSetting) {
  return Boolean((setting?.mode === 'preset' || setting?.mode === 'custom') && setting.url);
}

export function useSavedPageBackground(page: BackgroundPage) {
  const [setting, setSetting] = useState<PageBackgroundSetting>(DEFAULT_BACKGROUND);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setSetting(DEFAULT_BACKGROUND);
      return undefined;
    }

    return onSnapshot(doc(db, 'users', userId), (snapshot) => {
      const backgrounds = snapshot.data()?.backgrounds;
      setSetting(backgrounds?.[page] || DEFAULT_BACKGROUND);
    }, () => {
      setSetting(DEFAULT_BACKGROUND);
    });
  }, [page, userId]);

  return useMemo(() => ({
    setting,
    style: getBackgroundStyle(setting),
    imageStyle: getBackgroundImageLayerStyle(setting),
    hasImage: hasBackgroundImage(setting),
  }), [setting]);
}
