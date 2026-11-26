/** Saydam ya da beyaza yakın kenar payı dışında kalan dikdörtgen (görsel boşsa null). */
export function contentBounds(rgba: Uint8ClampedArray, width: number, height: number) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const blank = rgba[i + 3] < 16 || (rgba[i] > 244 && rgba[i + 1] > 244 && rgba[i + 2] > 244);
      if (blank) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
