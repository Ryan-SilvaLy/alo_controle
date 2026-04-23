import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IniciarPedidoComponent } from './iniciar-pedido.component';

describe('IniciarPedidoComponent', () => {
  let component: IniciarPedidoComponent;
  let fixture: ComponentFixture<IniciarPedidoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IniciarPedidoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IniciarPedidoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
