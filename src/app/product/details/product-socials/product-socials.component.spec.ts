import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductSocialsComponent } from './product-socials.component';

describe('ProductSocialsComponent', () => {
  let component: ProductSocialsComponent;
  let fixture: ComponentFixture<ProductSocialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductSocialsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductSocialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
