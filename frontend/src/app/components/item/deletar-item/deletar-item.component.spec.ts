import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletarItemComponent } from './deletar-item.component';

describe('DeletarItemComponent', () => {
  let component: DeletarItemComponent;
  let fixture: ComponentFixture<DeletarItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletarItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletarItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
