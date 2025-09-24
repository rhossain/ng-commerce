import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WishlistCounterComponent } from './wishlist-counter.component';

describe('WishlistCounterComponent', () => {
  let component: WishlistCounterComponent;
  let fixture: ComponentFixture<WishlistCounterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WishlistCounterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WishlistCounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
