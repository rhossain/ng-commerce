import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingSummaryComponent } from './rating-summary.component';

describe('RatingSummaryComponent', () => {
  let component: RatingSummaryComponent;
  let fixture: ComponentFixture<RatingSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingSummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RatingSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
