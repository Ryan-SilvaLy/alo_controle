import { SnackbarService } from './../../../shared/snackbar/snackbar.service';
import { Item, ItemCreate, TipoItem } from './../../../services/item.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ItemService } from '../../../services/item.service';
import { ModalTipoItemComponent } from '../modal-tipo-item/modal-tipo-item.component';
import { ItemComponent } from '../item.component';
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

  // controla a exibição do modal
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

  // objeto que será usado no formulário
  item: ItemCreate = { ...this.itemBase };

  tiposItem: TipoItem[] = [];
  tipoItemLabel = (tipo: TipoItem) => tipo?.nome ?? '';

  constructor(
    public itemService: ItemService,
    private router: Router,
    private snackbar: SnackbarService,
    private itemComponent: ItemComponent
  ) {}

  ngOnInit() {
    this.carregarTipos();
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

  abrirModal() {
    this.mostrarModal = true;
  }

  fecharModal() {
    this.mostrarModal = false;
  }

  criarItem() {
    if (
      !this.item?.nome?.trim() ||
      !this.item?.tipo_item_id ||
      !this.item?.prateleira_estoque?.trim() ||
      !this.item?.codigo?.trim() ||
      !this.item?.codigo_barras?.trim()
    ) {
      this.snackbar.show('Por favor, preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    this.itemService.criarItem(this.item).subscribe({
      next: (novoItem) => {
        this.snackbar.show('Item criado com sucesso.', 'success');
        this.fecharModal(); // fecha o modal depois de salvar
        this.item = { ...this.itemBase };
        this.itemCriado.emit(novoItem);
      },
      error: (err) => {
        console.error('Erro ao criar item:', err);

        if (err?.error?.errors?.codigo_barras) {
          const mensagens = Array.isArray(err.error.errors.codigo_barras)
            ? err.error.errors.codigo_barras.join(' ')
            : err.error.errors.codigo_barras;
          this.snackbar.show(`Erro no código de barras: ${mensagens}`, 'error');

        } else if (err?.error?.errors?.codigo) {
          const mensagens = Array.isArray(err.error.errors.codigo)
            ? err.error.errors.codigo.join(' ')
            : err.error.errors.codigo;
          this.snackbar.show(`Erro no código do item: ${mensagens}`, 'error');

        } else {
          this.snackbar.show(err?.error?.message || 'Erro ao criar item. Verifique os dados.', 'error');
        }
      }
    });
  }


  // Função pura que gera um código numérico aleatório de 12 dígitos
  gerarCodigoBarras(): string {
    let codigo = '';
    for (let i = 0; i < 12; i++) {
      codigo += Math.floor(Math.random() * 10).toString();
    }
    return codigo;
  }

  onGerarCodigoItem() {
  this.item.codigo = this.itemComponent.gerarCodigoItem();
  this.snackbar.show('Código do item gerado com sucesso.', 'success');
}

  // Método para atribuir o código gerado ao modelo (input)
  onGerarCodigoBarras() {
    this.item.codigo_barras = this.gerarCodigoBarras();
    this.snackbar.show('Código de barras gerado com sucesso.', 'success');
  }

  tipoCriado(novoTipo: TipoItem) {
    this.carregarTipos();
    this.item.tipo_item_id = novoTipo.id; // já seleciona o recém-criado
    this.snackbar.show(`Tipo criado: ${novoTipo.nome}`, 'success');
  }
}
