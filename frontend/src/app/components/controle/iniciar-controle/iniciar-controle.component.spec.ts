import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IniciarControleComponent } from './iniciar-controle.component';

describe('IniciarControleComponent', () => {
  let component: IniciarControleComponent;
  let fixture: ComponentFixture<IniciarControleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IniciarControleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IniciarControleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
