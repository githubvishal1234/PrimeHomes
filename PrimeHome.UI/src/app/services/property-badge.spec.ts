import { TestBed } from '@angular/core/testing';
import { PropertyBadgeService } from './property-badge';

describe('PropertyBadgeService', () => {
  let service: PropertyBadgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PropertyBadgeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
