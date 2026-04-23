import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarEntradaComponent } from './registrar-entrada.component';

describe('RegistrarEntradaComponent', () => {
  let component: RegistrarEntradaComponent;
  let fixture: ComponentFixture<RegistrarEntradaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrarEntradaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistrarEntradaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
