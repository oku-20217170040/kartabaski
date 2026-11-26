'use client';

import dynamic from 'next/dynamic';
import './mug3d.css';

/* three.js yalnız üç boyutlu önizleme açılınca iner. */
const Mug3DLazy = dynamic(() => import('./Mug3DRef'), {
  ssr: false,
  loading: () => (
    <div className="m3d"><div className="m3d-stage" data-ready="false" /></div>
  ),
});

export default Mug3DLazy;
