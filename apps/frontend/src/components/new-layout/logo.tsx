'use client';

import Image from 'next/image';

export const Logo = () => {
  return (
    <Image
      src="/postiz.svg"
      alt="Letstok Social"
      width={80}
      height={80}
      className="mt-[8px] min-w-[60px] min-h-[60px] w-auto h-auto object-contain dark:invert"
    />
  );
};
