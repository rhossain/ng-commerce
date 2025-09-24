import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageCacheService {
  private cache = new Map<string, HTMLImageElement>();

  preloadImage(url: string): Promise<HTMLImageElement> {
    if (this.cache.has(url)) {
      return Promise.resolve(this.cache.get(url)!);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.cache.set(url, img);
        resolve(img);
      };

      img.onerror = reject;
      img.src = url;
    });
  }

  getCachedImage(url: string): HTMLImageElement | null {
    return this.cache.get(url) || null;
  }
}
