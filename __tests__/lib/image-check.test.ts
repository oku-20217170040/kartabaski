import { uploadedImageProblem, deliveryProbeUrl, MIN_IMAGE_SIDE } from '@/lib/image-check';

describe('uploadedImageProblem', () => {
  it('boyutu okunamayan görseli sorunlu sayar', () => {
    expect(uploadedImageProblem({})).toMatch(/bozuk/);
    expect(uploadedImageProblem({ width: 0, height: 800 })).toMatch(/bozuk/);
    expect(uploadedImageProblem({ width: 'x', height: 800 })).toMatch(/bozuk/);
  });

  it('çok küçük görseli sorunlu sayar', () => {
    expect(uploadedImageProblem({ width: 200, height: 2000 })).toContain(`${MIN_IMAGE_SIDE}`);
  });

  it('yeterli boyutlu görselde sorun yok', () => {
    expect(uploadedImageProblem({ width: 1200, height: 900 })).toBeNull();
    expect(uploadedImageProblem({ width: MIN_IMAGE_SIDE, height: MIN_IMAGE_SIDE })).toBeNull();
  });
});

describe('deliveryProbeUrl', () => {
  it('akışların kullandığı jpg dönüşümünü içerir', () => {
    expect(deliveryProbeUrl('demo', 'karta-baski/urunler/abc')).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto,w_1080,c_limit/karta-baski/urunler/abc'
    );
  });
});
