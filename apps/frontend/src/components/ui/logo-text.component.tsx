'use client';

import Image from 'next/image';

export const LogoTextComponent = () => {
  return (
    <Image
      src="/logo-text.svg"
      alt="LetsPost"
      width={400}
      height={120}
      priority
      className="w-[200px] h-auto object-contain"
    />
  );
};
