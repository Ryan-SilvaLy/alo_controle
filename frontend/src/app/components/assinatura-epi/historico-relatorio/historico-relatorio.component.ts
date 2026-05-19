import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';

import {
  AssinaturaEpiCompetenciaDetalhe,
  AssinaturaEpiRelatorio,
  AssinaturaEpiService,
} from '../../../services/assinatura-epi.service';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-historico-relatorio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './historico-relatorio.component.html',
  styleUrl: './historico-relatorio.component.scss'
})
export class HistoricoRelatorioComponent {
  competencia: AssinaturaEpiCompetenciaDetalhe | null = null;
  carregando = true;
  carregandoRelatorioId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private assinaturaEpiService: AssinaturaEpiService,
    private pdfService: PdfService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.carregando = false;
      this.snackbar.show('Competência não informada.', 'error');
      return;
    }

    this.carregarCompetencia(id);
  }

  carregarCompetencia(id: number): void {
    this.carregando = true;

    this.assinaturaEpiService.obterCompetencia(id).subscribe({
      next: (competencia) => {
        this.competencia = competencia;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.snackbar.show('Não foi possível carregar o histórico da competência.', 'error');
      }
    });
  }

  imprimirRelatorio(relatorio: AssinaturaEpiRelatorio): void {
    this.carregandoRelatorioId = relatorio.id;

    this.assinaturaEpiService.obterDadosImpressao(relatorio.id).subscribe({
      next: (dados) => {
        this.carregandoRelatorioId = null;
        this.pdfService.gerarPdfAssinaturaEpi(dados);
      },
      error: () => {
        this.carregandoRelatorioId = null;
        this.snackbar.show('Não foi possível carregar os dados para reimpressão.', 'error');
      }
    });
  }

  marcarAssinado(relatorio: AssinaturaEpiRelatorio): void {
    this.carregandoRelatorioId = relatorio.id;

    this.assinaturaEpiService.marcarAssinado(relatorio.id).subscribe({
      next: () => {
        this.carregandoRelatorioId = null;
        this.snackbar.show('Relatório marcado como assinado.', 'success');
        if (this.competencia) {
          this.carregarCompetencia(this.competencia.id);
        }
      },
      error: () => {
        this.carregandoRelatorioId = null;
        this.snackbar.show('Não foi possível marcar o relatório como assinado.', 'error');
      }
    });
  }

  getStatusAssinaturaLabel(status: string): string {
    if (status === 'pendente_assinatura') return 'Pendente de assinatura';
    if (status === 'assinado') return 'Assinado';
    return 'Sem relatório';
  }
}
