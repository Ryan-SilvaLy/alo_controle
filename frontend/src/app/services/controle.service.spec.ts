import { TestBed } from '@angular/core/testing';

import { ControleService } from './controle.service';

describe('ControleService', () => {
  let service: ControleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ControleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
