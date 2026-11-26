'use client';

import Mug3D, { Mug3DHandle, Mug3DProps } from './Mug3D';

/** next/dynamic ref aktarmadığı için tutamaç ayrı bir özellikle geçer. */
export type Mug3DRefProps = Mug3DProps & { handle?: React.Ref<Mug3DHandle> };

export default function Mug3DRef({ handle, ...props }: Mug3DRefProps) {
  return <Mug3D ref={handle} {...props} />;
}
