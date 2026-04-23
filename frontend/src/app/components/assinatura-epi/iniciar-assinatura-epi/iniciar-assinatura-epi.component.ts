import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import {
  AssinaturaEpiCompetencia,
  AssinaturaEpiCompetenciaDetalhe,
  AssinaturaEpiRelatorio,
  AssinaturaEpiService,
} from '../../../services/assinatura-epi.service';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-iniciar-assinatura-epi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './iniciar-assinatura-epi.component.html',
  styleUrl: './iniciar-assinatura-epi.component.scss'
})
export class IniciarAssinaturaEpiComponent {
  competencias: AssinaturaEpiCompetencia[] = [];
  carregando = false;
  carregandoAcaoId: number | null = null;
  erro: string | null = null;
  menuAbertoId: number | null = null;
  menuPosicao = { top: 0, left: 0 };

  filtros = {
    solicitante: '',
    mes: '',
    ano: '',
    status: ''
  };

  constructor(
    private assinaturaEpiService: AssinaturaEpiService,
    private pdfService: PdfService,
    private snackbar: SnackbarService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.carregarCompetencias();
  }

  carregarCompetencias(): void {
    this.carregando = true;
    this.erro = null;

    this.assinaturaEpiService.listarCompetencias(this.filtros).subscribe({
      next: (competencias) => {
        this.competencias = competencias;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Erro ao carregar as competencias de assinatura de EPI.';
      }
    });
  }

  limparFiltros(): void {
    this.filtros = {
      solicitante: '',
      mes: '',
      ano: '',
      status: ''
    };
    this.carregarCompetencias();
  }

  abrirDetalhes(competencia: AssinaturaEpiCompetencia): void {
    this.fecharMenuAcoes();
    this.router.navigate(['/assinatura-epi/detalhe', competencia.id]);
  }

  abrirHistorico(competencia: AssinaturaEpiCompetencia): void {
    this.fecharMenuAcoes();
    this.router.navigate(['/assinatura-epi/historico', competencia.id]);
  }

  gerarRelatorio(competencia: AssinaturaEpiCompetencia): void {
    this.fecharMenuAcoes();
    this.carregandoAcaoId = competencia.id;

    this.assinaturaEpiService.gerarRelatorio(competencia.id).subscribe({
      next: (relatorio) => {
        this.pdfService.gerarPdfAssinaturaEpi(relatorio);
        this.snackbar.show('Relatorio gerado e enviado para PDF.', 'success');
        this.carregandoAcaoId = null;
        this.carregarCompetencias();
      },
      error: (err) => {
        this.carregandoAcaoId = null;
        const mensagem = err?.error?.non_field_errors?.[0] || err?.error?.detail || 'Nao foi possivel gerar o relatorio.';
        this.snackbar.show(mensagem, 'error');
      }
    });
  }

  marcarUltimoPendente(competencia: AssinaturaEpiCompetencia): void {
    this.fecharMenuAcoes();
    this.carregandoAcaoId = competencia.id;

    this.assinaturaEpiService.obterCompetencia(competencia.id).subscribe({
      next: (detalhe) => {
        const relatorio = this.obterUltimoRelatorioPendente(detalhe);
        if (!relatorio) {
          this.carregandoAcaoId = null;
          this.snackbar.show('Nao existe relatorio pendente de assinatura para esta competencia.', 'warning');
          return;
        }

        this.assinaturaEpiService.marcarAssinado(relatorio.id).subscribe({
          next: () => {
            this.carregandoAcaoId = null;
            this.snackbar.show('Relatorio marcado como assinado.', 'success');
            this.carregarCompetencias();
          },
          error: () => {
            this.carregandoAcaoId = null;
            this.snackbar.show('Erro ao marcar o relatorio como assinado.', 'error');
          }
        });
      },
      error: () => {
        this.carregandoAcaoId = null;
        this.snackbar.show('Erro ao consultar os relatorios desta competencia.', 'error');
      }
    });
  }

  getStatusAssinaturaLabel(status: string): string {
    if (status === 'pendente_assinatura') return 'Pendente assinatura';
    if (status === 'assinado') return 'Assinado';
    return 'Sem relatorio';
  }

  getStatusCompetenciaLabel(status: string): string {
    return status === 'fechada' ? 'Fechada' : 'Aberta';
  }

  toggleMenuAcoes(event: MouseEvent, competenciaId: number): void {
    event.stopPropagation();
    if (this.menuAbertoId === competenciaId) {
      this.fecharMenuAcoes();
      return;
    }

    const elemento = event.currentTarget as HTMLElement | null;
    if (!elemento) {
      return;
    }

    const rect = elemento.getBoundingClientRect();
    const larguraMenu = 192;
    const alturaGap = 8;

    this.menuPosicao = {
      top: Math.max(12, rect.top - alturaGap),
      left: Math.max(12, rect.right - larguraMenu),
    };
    this.menuAbertoId = competenciaId;
  }

  fecharMenuAcoes(): void {
    this.menuAbertoId = null;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.fecharMenuAcoes();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.fecharMenuAcoes();
  }

  private obterUltimoRelatorioPendente(detalhe: AssinaturaEpiCompetenciaDetalhe): AssinaturaEpiRelatorio | undefined {
    return [...(detalhe.relatorios || [])]
      .sort((a, b) => b.sequencia_relatorio - a.sequencia_relatorio)
      .find(relatorio => relatorio.status_assinatura === 'pendente_assinatura');
  }
}
