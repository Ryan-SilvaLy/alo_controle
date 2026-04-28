import { SnackbarService } from './../../../shared/snackbar/snackbar.service';
import { Item, ItemCreate, TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ItemService } from '../../../services/item.service';
import { ModalTipoItemComponent } from '../modal-tipo-item/modal-tipo-item.component';
import { AutocompleteSelectComponent } from '../../../shared/autocomplete-select/autocomplete-select.component';

@Component({
  selector: 'app-criar-item',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalTipoItemComponent, AutocompleteSelectComponent],
  templateUrl: './criar-item.component.html',
  styleUrls: ['./criar-item.component.scss']
})
export class CriarItemComponent {
  @ViewChild('modalTipo') modalTipo!: ModalTipoItemComponent;
  @Output() itemCriado = new EventEmitter<Item>();

  mostrarModal = false;

  itemBase: ItemCreate = {
    codigo: '',
    nome: '',
    descricao: '',
    tipo_item_id: null,
    prateleira_estoque: '',
    quantidade_atual: 0,
    quantidade_minima: 0,
    valor_unitario: 0,
    unidade_medida: 'un',
    codigo_barras: '',
  };

  item: ItemCreate = { ...this.itemBase };

  tiposItem: TipoItem[] = [];
  itensExistentes: Item[] = [];
  codigoGeradoAutomaticamente = true;
  tipoItemLabel = (tipo: TipoItem) => tipo?.nome ?? '';

  constructor(
    public itemService: ItemService,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit() {
    this.carregarTipos();
    this.carregarItensExistentes();
  }

  carregarTipos() {
    this.itemService.listarTipoItem().subscribe({
      next: (data) => {
        this.tiposItem = data;
      },
      error: (err) => {
        console.error('Erro ao listar tipos de item:', err);
        this.snackbar.show('Erro ao carregar tipos de item.', 'error');
      }
    });
  }

  carregarItensExistentes() {
    this.itemService.listarItens().subscribe({
      next: (data) => {
        this.itensExistentes = Array.isArray(data) ? data : [];
        if (!this.item.codigo || this.codigoGeradoAutomaticamente) {
          this.atualizarCodigoAutomatico();
        }
      },
      error: () => {
        this.itensExistentes = [];
      }
    });
  }

  abrirModal() {
    this.mostrarModal = true;
    this.carregarItensExistentes();
    this.atualizarCodigoAutomatico();
  }

  fecharModal() {
    this.mostrarModal = false;
  }

  criarItem() {
    if (!this.item.codigo?.trim()) {
      this.atualizarCodigoAutomatico();
    }

    this.item.codigo = this.normalizarCodigoDigitado(this.item.codigo);

    if (
      !this.item?.nome?.trim() ||
      !this.item?.tipo_item_id ||
      !this.item?.prateleira_estoque?.trim() ||
      !this.item?.codigo?.trim() ||
      !this.item?.codigo_barras?.trim()
    ) {
      this.snackbar.show('Por favor, preencha todos os campos obrigatorios.', 'warning');
      return;
    }

    this.itemService.criarItem(this.item).subscribe({
      next: (novoItem) => {
        this.snackbar.show('Item criado com sucesso.', 'success');
        this.fecharModal();
        this.item = { ...this.itemBase };
        this.codigoGeradoAutomaticamente = true;
        this.carregarItensExistentes();
        this.itemCriado.emit(novoItem);
      },
      error: (err) => {
        console.error('Erro ao criar item:', err);

        if (err?.error?.errors?.codigo_barras) {
          const mensagens = Array.isArray(err.error.errors.codigo_barras)
            ? err.error.errors.codigo_barras.join(' ')
            : err.error.errors.codigo_barras;
          this.snackbar.show(`Erro no codigo de barras: ${mensagens}`, 'error');

        } else if (err?.error?.errors?.codigo) {
          const mensagens = Array.isArray(err.error.errors.codigo)
            ? err.error.errors.codigo.join(' ')
            : err.error.errors.codigo;
          this.snackbar.show(`Erro no codigo do item: ${mensagens}`, 'error');

        } else {
          this.snackbar.show(err?.error?.message || 'Erro ao criar item. Verifique os dados.', 'error');
        }
      }
    });
  }

  gerarCodigoBarras(): string {
    let codigo = '';
    for (let i = 0; i < 12; i++) {
      codigo += Math.floor(Math.random() * 10).toString();
    }
    return codigo;
  }

  onGerarCodigoItem() {
    const codigo = this.gerarCodigoItemPorNome(this.item.nome);
    if (!codigo) {
      this.snackbar.show('Informe um nome com letras para gerar o codigo do item.', 'warning');
      return;
    }

    this.item.codigo = codigo;
    this.codigoGeradoAutomaticamente = true;
    this.snackbar.show('Codigo do item gerado com sucesso.', 'success');
  }

  onNomeChange(nome: string) {
    this.item.nome = nome;
    if (!this.item.codigo || this.codigoGeradoAutomaticamente) {
      this.atualizarCodigoAutomatico();
    }
  }

  onCodigoChange(codigo: string) {
    this.item.codigo = this.normalizarCodigoDigitado(codigo);
    this.codigoGeradoAutomaticamente = false;
  }

  onGerarCodigoBarras() {
    this.item.codigo_barras = this.gerarCodigoBarras();
    this.snackbar.show('Codigo de barras gerado com sucesso.', 'success');
  }

  tipoCriado(novoTipo: TipoItem) {
    this.carregarTipos();
    this.item.tipo_item_id = novoTipo.id;
    this.snackbar.show(`Tipo criado: ${novoTipo.nome}`, 'success');
  }

  private atualizarCodigoAutomatico() {
    const codigo = this.gerarCodigoItemPorNome(this.item.nome);
    if (codigo) {
      this.item.codigo = codigo;
      this.codigoGeradoAutomaticamente = true;
    }
  }

  private gerarCodigoItemPorNome(nome: string): string {
    const prefixo = this.obterPrefixoCodigo(nome);
    if (!prefixo) {
      return '';
    }

    const totalDigitos = 8 - prefixo.length;
    const limite = Math.pow(10, totalDigitos) - 1;
    const codigosExistentes = new Set(
      this.itensExistentes
        .map(item => this.normalizarCodigoDigitado(item.codigo || ''))
        .filter(Boolean)
    );
    const regexPrefixo = new RegExp(`^${prefixo}\\d{${totalDigitos}}$`);
    const maiorSequencial = this.itensExistentes.reduce((maior, item) => {
      const codigo = this.normalizarCodigoDigitado(item.codigo || '');
      if (!regexPrefixo.test(codigo)) {
        return maior;
      }

      const numero = Number(codigo.slice(prefixo.length));
      return Number.isFinite(numero) ? Math.max(maior, numero) : maior;
    }, 0);

    for (let numero = maiorSequencial + 1; numero <= limite; numero++) {
      const codigo = `${prefixo}${numero.toString().padStart(totalDigitos, '0')}`;
      if (!codigosExistentes.has(codigo)) {
        return codigo;
      }
    }

    for (let tentativa = 0; tentativa < 1000; tentativa++) {
      const numero = Math.floor(Math.random() * (limite + 1));
      const codigo = `${prefixo}${numero.toString().padStart(totalDigitos, '0')}`;
      if (!codigosExistentes.has(codigo)) {
        return codigo;
      }
    }

    return '';
  }

  private obterPrefixoCodigo(nome: string): string {
    return (nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3);
  }

  private normalizarCodigoDigitado(codigo: string): string {
    return (codigo || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
  }
}
