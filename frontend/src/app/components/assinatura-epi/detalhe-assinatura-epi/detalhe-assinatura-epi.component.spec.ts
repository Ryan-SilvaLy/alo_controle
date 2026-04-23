import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalheAssinaturaEpiComponent } from './detalhe-assinatura-epi.component';

describe('DetalheAssinaturaEpiComponent', () => {
  let component: DetalheAssinaturaEpiComponent;
  let fixture: ComponentFixture<DetalheAssinaturaEpiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalheAssinaturaEpiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalheAssinaturaEpiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
