import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgxImageZoomModule } from 'ngx-image-zoom';
import { environment } from '../../../environments/environment';
import { ProductImageModel, ProductModel, ProductOption, ProductOptionValue, ProductVariant, ProductReview } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { StarRatingComponent } from "../../shared/star-rating/star-rating.component";

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, NgxImageZoomModule, StarRatingComponent],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss'
})
export default class DetailsComponent implements OnInit {
  productId!: number;
  product!: ProductModel;
  categories: ProductCategory[] = [];
  categoryMap: { [id: number]: string } = {};
  categoryName = '';
  selectedImageUrl!: string;
  selectedImageType!: string;
  selectedOptions: { [key: string]: string } = {};
  selectedVariant: ProductVariant | null = null;
  groupedOptions: { [key: string]: string[] } = {};

  apiUrl = environment.apiBaseUrl;
  productImages: ProductImageModel[] = [];
  productImageUrl = environment.apiEndpoints.product_images.getImage;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    const paramId = this.route.snapshot.paramMap.get('productId') ?? '0';
    this.productId = +paramId;

    this.route.paramMap.subscribe((params) => {
      const id = params.get('productId') ?? '0';
      this.productId = +id;
      this.getProduct();
      this.getCategoryName();
    });

  }

  getProduct(): void {
    this.productService.getProduct(this.productId).subscribe({
      next: (data: ProductModel) => {
        this.product = data;
  
        console.log('Product category ID:', this.product.category_id);
        this.categoryName = this.categoryMap[this.product.category_id] || 'Unknown';
        console.log('Assigned category name:', this.categoryName);

        // Show default variant (first one) by default
        if (this.product?.variants && this.product.variants.length > 0) {
          this.selectedVariant = this.product.variants[0];
        }
  
        // Group options for the UI
        if (this.product?.options) {
          this.groupProductOptions(this.product.options);
        }
  
        // Flatten variant images
        this.productImages = data.variants?.flatMap(variant => variant.product_images) || [];
  
        // Show first image
        if (this.productImages.length > 0) {
          this.selectedImageUrl = this.productImages[0].image_url;
          this.selectedImageType = this.getMediaType(this.selectedImageUrl);
        }
  
        // Reset selected options
        this.selectedOptions = {};

        // ✅ Set category name if map is ready
        this.getCategoryName();
      },
      error: (error) => {
        console.error('Error fetching product details', error);
      }
    });
  }

  get avgRating(): number {
    return this.productService.getAverageRating(this.product.reviews);
  }

  getCategoryName() {
    this.categoryService.getAllCategories().subscribe(categories => {
      return this.categoryName = this.categoryService.getCategoryNameById(this.product.category_id, categories);
    });
  }

  mediaClicked(mediaUrl: string): void {
    this.selectedImageUrl = mediaUrl;
    this.selectedImageType = this.getMediaType(mediaUrl);
  }

  getMediaType(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase();
    return ext === 'mp4' || ext === 'webm' ? 'video' : 'image';
  }

  isVideo(): boolean {
    return this.selectedImageType === 'video';
  }

  private groupProductOptions(options: any[]): void {
    const optionGroups: { [key: string]: string[] } = {};
  
    options.forEach(option => {
      const values: ProductOptionValue[] = option.option_values || [];
  
      values.forEach((ov: ProductOptionValue) => {
        const key = ov.option_name;
        const value = ov.option_value;
  
        if (!optionGroups[key]) {
          optionGroups[key] = [];
        }
  
        if (!optionGroups[key].includes(value)) {
          optionGroups[key].push(value);
        }
      });
    });
  
    this.groupedOptions = optionGroups;
    // console.log('Grouped Options:', this.groupedOptions);
  }  

  onOptionSelect(optionName: string, value: string) {
    this.selectedOptions[optionName] = value;
    console.log('Selected Options:', this.selectedOptions);
    this.updateSelectedVariant();
    console.log('Selected Variant:', this.selectedVariant);
  }

  updateSelectedVariant(): void {
    if (!this.product?.variants) return;
  
    // Try to find a variant that matches at least one selected option
    this.selectedVariant = this.product.variants.find(variant => {
      return Object.entries(this.selectedOptions).some(([name, value]) =>
        variant.optionValues?.[name] === value
      );
    }) ?? null;
  
    console.log('Selected Options:', this.selectedOptions);
    console.log('Selected Variant:', this.selectedVariant);
  }      

  getOptionNames(): string[] {
    return Object.keys(this.groupedOptions || {});
  }
}