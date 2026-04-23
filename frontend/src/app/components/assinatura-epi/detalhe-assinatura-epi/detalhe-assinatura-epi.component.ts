import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { AssinaturaEpiCompetenciaDetalhe, AssinaturaEpiService } from '../../../services/assinatura-epi.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-detalhe-assinatura-epi',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detalhe-assinatura-epi.component.html',
  styleUrl: './detalhe-assinatura-epi.component.scss'
})
export class DetalheAssinaturaEpiComponent {
  competencia: AssinaturaEpiCompetenciaDetalhe | null = null;
  carregando = true;

  constructor(
    private route: ActivatedRoute,
    private assinaturaEpiService: AssinaturaEpiService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.carregando = false;
      this.snackbar.show('Competencia nao informada.', 'error');
      return;
    }

    this.assinaturaEpiService.obterCompetencia(id).subscribe({
      next: (competencia) => {
        this.competencia = competencia;
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.snackbar.show('Erro ao carregar os detalhes da competencia.', 'error');
      }
    });
  }
}
