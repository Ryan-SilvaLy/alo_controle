import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AtualizarPedidoComponent } from './atualizar-pedido.component';

describe('AtualizarPedidoComponent', () => {
  let component: AtualizarPedidoComponent;
  let fixture: ComponentFixture<AtualizarPedidoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtualizarPedidoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AtualizarPedidoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
