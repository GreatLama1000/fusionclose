import React from 'react';

type Props = {
  path: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export default function Icon({ path, size = 18, className = '', strokeWidth = 1.75 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
