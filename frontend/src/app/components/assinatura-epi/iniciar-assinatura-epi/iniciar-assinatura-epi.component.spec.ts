import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IniciarAssinaturaEpiComponent } from './iniciar-assinatura-epi.component';

describe('IniciarAssinaturaEpiComponent', () => {
  let component: IniciarAssinaturaEpiComponent;
  let fixture: ComponentFixture<IniciarAssinaturaEpiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IniciarAssinaturaEpiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IniciarAssinaturaEpiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
