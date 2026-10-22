import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = ({ size = 16, ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const IconUndo = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h9a6 6 0 0 1 0 12H8" />
  </svg>
);

export const IconRedo = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9h-9a6 6 0 0 0 0 12h5" />
  </svg>
);

export const IconPlus = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconTrash = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const IconCopy = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a2 2 0 0 0-2 2v9" />
  </svg>
);

export const IconEye = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const IconEyeOff = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 4l16 16" />
    <path d="M9.6 6.3A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8" />
    <path d="M6.4 7.8A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 3.4-.6" />
  </svg>
);

export const IconSun = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
);

export const IconMoon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

export const IconDownload = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconText = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 6h14M12 6v13M9 19h6" />
  </svg>
);

export const IconImage = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 18 5.5-5 4 3.5L17 12l3 3.5" />
  </svg>
);

export const IconClose = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconChevron = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconLayers = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);

export const IconCompare = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="5" width="7" height="14" rx="1.5" />
    <rect x="14" y="5" width="7" height="14" rx="1.5" />
    <path d="M12 3v18" strokeDasharray="2 3" />
  </svg>
);

export const IconUpload = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 16V4m0 0L8 8m4-4 4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconArrowLeft = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconArrowRight = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconSparkle = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11 10 9Z" />
  </svg>
);

export const IconLock = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </svg>
);

export const IconCheck = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="m5 13 4 4 10-10" />
  </svg>
);
