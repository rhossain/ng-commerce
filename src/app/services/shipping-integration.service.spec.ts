import { TestBed } from '@angular/core/testing';

import { ShippingIntegrationService } from './shipping-integration.service';

describe('ShippingIntegrationService', () => {
  let service: ShippingIntegrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShippingIntegrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
