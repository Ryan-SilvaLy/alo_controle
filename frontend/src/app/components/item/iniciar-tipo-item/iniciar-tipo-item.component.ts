import { ItemService, TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { ModalTipoItemComponent } from '../modal-tipo-item/modal-tipo-item.component';


@Component({
  selector: 'app-iniciar-tipo-item',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PaginationComponent, ModalTipoItemComponent],
  templateUrl: './iniciar-tipo-item.component.html',
  styleUrl: './iniciar-tipo-item.component.scss'
})
export class IniciarTipoItemComponent implements OnInit {
  tiposItens: any[] = [];
  carregando = true;
  formAtualizar!: FormGroup;
  idTipoItem!: number;
  modalAberto = false; 
tiposItensSemRelacionamento: any[] = []; 

tipoItemParaExcluir: any = null;
modalExcluirAberto = false;

paginaAtual = 1;
itensPorPagina = 10;
tiposItensPaginados: any[] = [];

atualizarItensPaginados() {
  const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
  this.tiposItensPaginados = this.tiposItens.slice(inicio, inicio + this.itensPorPagina);
}

  constructor(
    private itemService: ItemService,
    private fb: FormBuilder,
    private snackbar: SnackbarService
  ) {
    this.formAtualizar = this.fb.group({
      nome: ['', Validators.required],
      grupo_secundario: [false],
    });
  }

  ngOnInit(): void {
    this.carregarTiposItens();
  }

carregarTiposItens() {
  this.carregando = true;
  this.itemService.listarTipoItem().subscribe({
    next: (tipos) => {
      this.itemService.listarItens().subscribe({
        next: (itens) => {
          const tiposEmUso = new Set(itens.map(i => i.tipo_item.id));
          this.tiposItensSemRelacionamento = (tipos as TipoItem[])
            .filter(t => !tiposEmUso.has(t.id))
            .sort((a, b) => a.id - b.id);

          this.tiposItens = (tipos as TipoItem[])
            .sort((a, b) => a.id - b.id);

          this.atualizarItensPaginados();
          this.carregando = false;
        },
        error: (err) => {
          console.error('Erro ao listar itens', err);
          this.carregando = false;
        }
      });
    },
    error: (err) => {
      console.error('Erro ao listar tipos de itens', err);
      this.carregando = false;
    }
  });
}


  onSubmitAtualizar() { // <- renomeado
    if (this.formAtualizar.valid) {
      this.itemService.atualizarTipoItem(this.idTipoItem, this.formAtualizar.value).subscribe({
        next: () => {
          this.snackbar.show('Tipo de item atualizado com sucesso!', 'success');
          this.fecharModal();
          this.carregarTiposItens();
        },
        error: (err) => {
          console.error(err);
          this.snackbar.show('Erro ao atualizar tipo de item', 'error');
        },
      });
    }
  }

  abrirModal(tipo: any) {
    this.modalAberto = true;
    this.idTipoItem = tipo.id;
    this.formAtualizar.patchValue({
      nome: tipo.nome,
      grupo_secundario: !!tipo.grupo_secundario,
    });
  }

  fecharModal() {
    this.modalAberto = false;
    this.formAtualizar.reset();
  }


abrirModalExcluir(tipo: any) {
  this.tipoItemParaExcluir = tipo;
  this.modalExcluirAberto = true;
}

fecharModalExcluir() {
  this.tipoItemParaExcluir = null;
  this.modalExcluirAberto = false;
}

confirmarExclusao() {
  if (!this.tipoItemParaExcluir) return;

  this.itemService.excluirTipoItem(this.tipoItemParaExcluir.id).subscribe({
    next: () => {
      this.snackbar.show('Tipo de item excluído com sucesso!', 'success');
      this.fecharModalExcluir();
      this.carregarTiposItens();
    },
    error: (err) => {
      console.error(err);
      this.snackbar.show('Erro ao excluir tipo de item', 'error');
    }
  });

}
tipoItemPodeExcluir(id: number): boolean {
  return this.tiposItensSemRelacionamento.some(t => t.id === id);
}

tipoCriado(novoTipo: TipoItem) {
  this.snackbar.show(`Tipo criado: ${novoTipo.nome}`, 'success');
  this.carregarTiposItens();
}

alternarStatusKpi(tipo: TipoItem) {
  const novoStatus = !tipo.grupo_secundario;

  this.itemService.atualizarTipoItem(tipo.id, { grupo_secundario: novoStatus }).subscribe({
    next: (tipoAtualizado) => {
      const aplicarAtualizacao = (registro: any) => {
        if (registro.id === tipo.id) {
          registro.grupo_secundario = tipoAtualizado?.grupo_secundario ?? novoStatus;
        }
        return registro;
      };

      this.tiposItens = this.tiposItens.map(aplicarAtualizacao);
      this.tiposItensSemRelacionamento = this.tiposItensSemRelacionamento.map(aplicarAtualizacao);
      this.atualizarItensPaginados();

      this.snackbar.show(
        novoStatus ? 'Grupo marcado como secundario para KPIs.' : 'Grupo marcado como principal para KPIs.',
        'success'
      );
    },
    error: (err) => {
      console.error(err);
      this.snackbar.show('Erro ao alterar status KPI do grupo.', 'error');
    }
  });
}

}
