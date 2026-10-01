import type { SVGProps } from 'react';

export type IconName = 'search' | 'map' | 'layers' | 'photo' | 'download' | 'upload' | 'plus' | 'arrow' | 'check' | 'close' | 'refresh' | 'target' | 'clock' | 'leaf' | 'water' | 'chevron' | 'alert';

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const shapes = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15m6-12v15" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    photo: <><rect x="3" y="5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v3h16v-3" /></>,
    upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M4 16v4h16v-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2m10 8h-2M12 22v-2M2 12h2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    leaf: <><path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-7 8-16Z" /><path d="M5 21c2-5 6-8 11-11" /></>,
    water: <><path d="M12 3c-3 4-7 8-7 12a7 7 0 0 0 14 0c0-4-4-8-7-12Z" /><path d="M9 16a3 3 0 0 0 3 3" /></>,
    chevron: <><path d="m7 10 5 5 5-5" /></>,
    alert: <><path d="M10.3 4.3 2.8 18a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common} {...props}>{shapes[name]}</svg>;
}

