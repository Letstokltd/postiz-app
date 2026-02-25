'use client';

import Image from 'next/image';

export const LogoTextComponent = () => {
  return (
    <Image
      src="/postiz-text.svg"
      alt="Letstok Social"
      width={180}
      height={56}
      priority
      className="h-8 w-auto object-contain dark:invert"
    />
  );
};
