import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwiperOptions } from 'swiper/types';
import { NgxImageZoomModule } from 'ngx-image-zoom';
@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [CommonModule, NgxImageZoomModule],
  templateUrl: './product-gallery.component.html',
  styleUrl: './product-gallery.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductGalleryComponent {
  @Input() product: any;
  @Input() productImages: any[] = [];
  loadingImages: boolean[] = [];
  @Input() selectedImageUrl: string = '';
  @Input() isVideo: () => boolean = () => false;

  @Output() mediaSelected = new EventEmitter<string>();

  onMediaClick(url: string) {
    this.mediaSelected.emit(url);
  }

  sliderConfig: SwiperOptions = {
    slidesPerView: 4,
    spaceBetween: 10,
    // pagination: { clickable: true },
    allowTouchMove: true,
    // If we need pagination
    pagination: {
      el: '.swiper-pagination',
    },

    // Navigation arrows
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },

    // And if we need scrollbar
    scrollbar: {
      el: '.swiper-scrollbar',
    },
  };
}
