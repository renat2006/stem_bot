export function keyMagenta(input: Uint8Array, width: number, height: number) {
  const pixels = new Uint8Array(input);
  let transparent = 0;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const red = pixels[index] ?? 0,
        green = pixels[index + 1] ?? 0,
        blue = pixels[index + 2] ?? 0;
      const key = Math.max(0, Math.min(1, (Math.min(red, blue) - green - 45) / 140));
      const alpha = ((1 - key) * (pixels[index + 3] ?? 255)) / 255;
      pixels[index + 3] = Math.round(alpha * 255);
      if (alpha < 0.05) {
        transparent++;
        pixels[index] = 0;
        pixels[index + 1] = 0;
        pixels[index + 2] = 0;
      } else {
        if (key > 0 && alpha > 0.05) {
          pixels[index] = Math.max(0, Math.min(255, (red - key * 255) / (1 - key)));
          pixels[index + 2] = Math.max(0, Math.min(255, (blue - key * 255) / (1 - key)));
        }
        if (alpha > 0.2) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
  if (transparent / (width * height) < 0.25) throw new Error("Expected at least 25% transparent background");
  if (right < left || bottom < top) throw new Error("No foreground object");
  if (left < 2 || top < 2 || right > width - 3 || bottom > height - 3)
    throw new Error("Object touches canvas edge");
  return { pixels, bounds: { left, top, width: right - left + 1, height: bottom - top + 1 } };
}
