import { PdfService } from './../../../shared/pdf/pdf.service';
import { Item, ItemService, TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { CriarItemComponent } from '../criar-item/criar-item.component';
import { AtualizarItemComponent } from '../atualizar-item/atualizar-item.component';
import { UnidadeNomePipe } from '../../../pipe/unidade-nome.pipe';
import { QuantidadeFormatPipe } from '../../../pipe/quantidade-format.pipe';

@Component({
  selector: 'app-iniciar-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    HasPermissionDirective,
    PaginationComponent,
    CriarItemComponent ,
    AtualizarItemComponent,
    UnidadeNomePipe, 
    QuantidadeFormatPipe
  ],
  templateUrl: './iniciar-item.component.html',
  styleUrl: './iniciar-item.component.scss'
})
export class IniciarItemComponent {
  @ViewChild(CriarItemComponent) criarItemComponent!: CriarItemComponent; 
  @ViewChild(AtualizarItemComponent) atualizarItemComponent!: AtualizarItemComponent;


  itens: Item[] = [];
  carregando = true;
  erro: string | null = null; 

  modalAberto = false;
  itemSelecionado: Item | null = null;

  paginaAtual = 1;
  itensPorPagina = 25;
  itensPaginados: Item[] = [];
  itensFiltrados: Item[] = [];

  filtros = {
    nome: '',
    codigo: '',
    codigo_barras: '',
    tipo_item: null as TipoItem | null,
    prateleira: '',
    situacao: '',
    status: '',
  };

  tipos: TipoItem[] = [];

  constructor(
    public itemService: ItemService,
    private snackbar: SnackbarService,
    private pdfService: PdfService
  ) {}

  ngOnInit(): void {
    this.carregarItens();
  }

  carregarItens(): void {
  this.itemService.listarItens().subscribe({
    next: (res) => {
      // converte quantidades para number
      this.itens = res.map(item => ({
        ...item,
        quantidade_atual: Number(String(item.quantidade_atual).replace(',', '.').trim()),
        quantidade_minima: Number(String(item.quantidade_minima).replace(',', '.').trim())
      }));

      this.carregando = false;
      this.erro = null;

      // gera lista de tipos únicos
      this.tipos = Array.from(
        new Map(this.itens.map(i => [i.tipo_item.id, i.tipo_item])).values()
      );

      this.filtrarItens();
    },
    error: () => {
      this.carregando = false;
      this.erro = 'Erro ao carregar itens.';
      this.snackbar.show(this.erro, 'error');
    }
  });
}

abrirModalAtualizar(id: number): void {
  this.atualizarItemComponent.abrirModal(id);
}

resetarFiltros() {
  this.filtros = {
    nome: '',
    codigo: '',
    codigo_barras: '',
    tipo_item: null,
    prateleira: '',
    situacao: '',
    status: '',
  };
  this.filtrarItens();
}

  tipoCriado(novoTipo: TipoItem) {
    this.snackbar.show(`Tipo criado: ${novoTipo.nome}`, 'success');
    this.carregarItens();
  }

  filtrarItens(): void {
    this.itensFiltrados = this.itens.filter(item => {
      const nomeMatch = item.nome.toLowerCase().includes(this.filtros.nome.toLowerCase());
      const codigoMatch = item.codigo.toLowerCase().includes(this.filtros.codigo.toLowerCase());
      const codigoBarrasMatch = (item.codigo_barras ?? '').toLowerCase().includes(this.filtros.codigo_barras.toLowerCase());
      const tipoMatch = this.filtros.tipo_item 
        ? item.tipo_item?.id === this.filtros.tipo_item.id : true;
      const prateleiraMatch = item.prateleira_estoque.toLowerCase().includes(this.filtros.prateleira.toLowerCase());

      let situacaoMatch = true;

      if (this.filtros.situacao === 'ok') {
        situacaoMatch = item.quantidade_atual >= item.quantidade_minima;
      } else if (this.filtros.situacao === 'baixo') {
        situacaoMatch = item.quantidade_atual < item.quantidade_minima;
      }

      const statusMatch = this.filtros.status ? item.status === this.filtros.status : true;

      return nomeMatch && codigoMatch && codigoBarrasMatch && tipoMatch && prateleiraMatch && situacaoMatch && statusMatch;
    });

    this.paginaAtual = 1;
    this.atualizarItensPaginados();
  }

  atualizarItensPaginados() {
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    this.itensPaginados = this.itensFiltrados.slice(inicio, inicio + this.itensPorPagina);
  }

  abrirModal(item: Item) {
    this.itemSelecionado = item;
    this.modalAberto = true;
  }

  fecharModal() {
    this.modalAberto = false;
    this.itemSelecionado = null;
  }

  confirmarMudanca() {
    if (!this.itemSelecionado) return;

    this.itemService.atualizarStatusItem(this.itemSelecionado.id).subscribe({
      next: (res) => {
        this.itemSelecionado!.status = res.status;
        this.filtrarItens();
        this.snackbar.show('Status atualizado com sucesso.', 'success');
        this.fecharModal();
      },
      error: () => {
        this.snackbar.show('Erro ao atualizar status.', 'error');
      }
    });
  }

  gerarRelatorioItensEmBaixa() {
    const itensEmBaixa = this.itens.filter(item => item.quantidade_atual < item.quantidade_minima);

    if (itensEmBaixa.length === 0) {
      this.snackbar.show('Não há itens em baixa no estoque.', 'info');
      return;
    }

    this.pdfService.gerarPdfItensEmBaixa(itensEmBaixa);
  }

  // 🔹 Novo método para acionar modal do CriarItemComponent
  abrirModalCriarItem() {
    this.criarItemComponent.abrirModal();
  }
}
