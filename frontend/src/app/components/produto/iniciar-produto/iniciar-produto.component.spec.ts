import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IniciarProdutoComponent } from './iniciar-produto.component';

describe('IniciarProdutoComponent', () => {
  let component: IniciarProdutoComponent;
  let fixture: ComponentFixture<IniciarProdutoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IniciarProdutoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IniciarProdutoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
