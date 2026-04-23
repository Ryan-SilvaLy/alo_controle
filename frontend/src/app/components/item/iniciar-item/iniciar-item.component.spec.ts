import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IniciarItemComponent } from './iniciar-item.component';

describe('IniciarItemComponent', () => {
  let component: IniciarItemComponent;
  let fixture: ComponentFixture<IniciarItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IniciarItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IniciarItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
