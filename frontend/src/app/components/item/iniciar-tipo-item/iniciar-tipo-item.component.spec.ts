import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IniciarTipoItemComponent } from './iniciar-tipo-item.component';

describe('IniciarTipoItemComponent', () => {
  let component: IniciarTipoItemComponent;
  let fixture: ComponentFixture<IniciarTipoItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IniciarTipoItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IniciarTipoItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
