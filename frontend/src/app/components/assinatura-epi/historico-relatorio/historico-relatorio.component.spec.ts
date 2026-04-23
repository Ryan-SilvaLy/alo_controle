import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricoRelatorioComponent } from './historico-relatorio.component';

describe('HistoricoRelatorioComponent', () => {
  let component: HistoricoRelatorioComponent;
  let fixture: ComponentFixture<HistoricoRelatorioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoricoRelatorioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoricoRelatorioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
