import { Item, ItemService, TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { ModalTipoItemComponent } from '../modal-tipo-item/modal-tipo-item.component';
import { PdfService } from '../../../shared/pdf/pdf.service';


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
itensCodigosBarras: Item[] = [];
itensCodigosFiltrados: Item[] = [];
idsCodigosSelecionados = new Set<number>();
carregandoCodigos = false;
imprimindoCodigos = false;
filtrosCodigos = {
  tipo: '',
  nome: '',
  codigo: '',
};

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
    private snackbar: SnackbarService,
    private pdfService: PdfService
  ) {
    this.formAtualizar = this.fb.group({
      nome: ['', Validators.required],
      grupo_secundario: [false],
    });
  }

  ngOnInit(): void {
    this.carregarTiposItens();
    this.carregarCodigosBarras();
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

carregarCodigosBarras() {
  this.carregandoCodigos = true;

  this.itemService.listarCodigosBarras().subscribe({
    next: (itens) => {
      this.itensCodigosBarras = itens;
      this.filtrarCodigosBarras();
      this.carregandoCodigos = false;
    },
    error: () => {
      this.carregandoCodigos = false;
      this.snackbar.show('Não foi possível listar os códigos de barras.', 'error');
    }
  });
}

filtrarCodigosBarras() {
  const nome = this.filtrosCodigos.nome.toLowerCase().trim();
  const codigo = this.filtrosCodigos.codigo.toLowerCase().trim();
  const tipo = Number(this.filtrosCodigos.tipo || 0);

  this.itensCodigosFiltrados = this.itensCodigosBarras.filter(item => {
    const nomeMatch = !nome || item.nome.toLowerCase().includes(nome);
    const codigoMatch = !codigo || item.codigo.toLowerCase().includes(codigo) || (item.codigo_barras || '').toLowerCase().includes(codigo);
    const tipoMatch = !tipo || item.tipo_item?.id === tipo;
    return nomeMatch && codigoMatch && tipoMatch;
  });
}

alternarSelecaoCodigo(itemId: number, checked: boolean) {
  if (checked) {
    this.idsCodigosSelecionados.add(itemId);
    return;
  }

  this.idsCodigosSelecionados.delete(itemId);
}

alternarTodosCodigos(checked: boolean) {
  if (checked) {
    this.itensCodigosFiltrados.forEach(item => this.idsCodigosSelecionados.add(item.id));
    return;
  }

  this.itensCodigosFiltrados.forEach(item => this.idsCodigosSelecionados.delete(item.id));
}

codigoSelecionado(itemId: number): boolean {
  return this.idsCodigosSelecionados.has(itemId);
}

todosCodigosFiltradosSelecionados(): boolean {
  return this.itensCodigosFiltrados.length > 0
    && this.itensCodigosFiltrados.every(item => this.idsCodigosSelecionados.has(item.id));
}

async imprimirCodigosSelecionados() {
  const ids = Array.from(this.idsCodigosSelecionados);

  if (!ids.length) {
    this.snackbar.show('Selecione ao menos um item para imprimir.', 'warning');
    return;
  }

  this.imprimindoCodigos = true;

  try {
    const itensSelecionados = this.itensCodigosBarras.filter(item => this.idsCodigosSelecionados.has(item.id));
    await this.pdfService.gerarPdfCodigosBarras(itensSelecionados);
  } catch (err) {
    console.error(err);
    this.snackbar.show('Não foi possível gerar o PDF dos códigos de barras.', 'error');
  } finally {
    this.imprimindoCodigos = false;
  }
}


  onSubmitAtualizar() { // <- renomeado
    if (this.formAtualizar.valid) {
      this.itemService.atualizarTipoItem(this.idTipoItem, this.formAtualizar.value).subscribe({
        next: () => {
          this.snackbar.show('Tipo de item atualizado com sucesso.', 'success');
          this.fecharModal();
          this.carregarTiposItens();
        },
        error: (err) => {
          console.error(err);
          this.snackbar.show('Não foi possível atualizar o tipo de item.', 'error');
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
      this.snackbar.show('Tipo de item excluído com sucesso.', 'success');
      this.fecharModalExcluir();
      this.carregarTiposItens();
    },
    error: (err) => {
      console.error(err);
      this.snackbar.show('Não foi possível excluir o tipo de item.', 'error');
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
        novoStatus ? 'Grupo marcado como secundário para KPIs.' : 'Grupo marcado como principal para KPIs.',
        'success'
      );
    },
    error: (err) => {
      console.error(err);
      this.snackbar.show('Não foi possível alterar o status KPI do grupo.', 'error');
    }
  });
}

}
