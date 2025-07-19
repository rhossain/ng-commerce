import { TestBed } from '@angular/core/testing';

import { CartIntegrationService } from './cart-integration.service';

describe('CartIntegrationService', () => {
  let service: CartIntegrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartIntegrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
