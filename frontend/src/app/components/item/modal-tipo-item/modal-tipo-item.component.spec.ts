import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalTipoItemComponent } from './modal-tipo-item.component';

describe('ModalTipoItemComponent', () => {
  let component: ModalTipoItemComponent;
  let fixture: ComponentFixture<ModalTipoItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalTipoItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalTipoItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
