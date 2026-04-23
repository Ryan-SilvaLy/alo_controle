import { PedidoComponent } from './../pedido.component';
import { ModalConfirmarPedidoComponent, PedidoResumo } from './../modal-confirmar-pedido/modal-confirmar-pedido.component';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PedidoService } from '../../../services/pedido.service';
import { ItemService, Item } from '../../../services/item.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-atualizar-pedido',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalConfirmarPedidoComponent],
  templateUrl: './atualizar-pedido.component.html',
  styleUrl: './atualizar-pedido.component.scss'
})
export class AtualizarPedidoComponent implements OnInit {
  pedidoForm!: FormGroup;
  itensDisponiveis: Item[] = [];
  pedidoOriginal: any;
  itensSelecionados: number[] = [];
  modalConfirmacaoAberto = false;
  pedidoResumo!: PedidoResumo;


  constructor(
    private fb: FormBuilder,
    private pedidoService: PedidoService,
    private itemService: ItemService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: SnackbarService,
    private pedidoComponent: PedidoComponent
  ) {}
 
    ngOnInit() {
    this.pedidoOriginal = this.pedidoService.getPedido();

    if (!this.pedidoOriginal) {
      alert('Nenhum pedido selecionado para edição');
      this.router.navigate(['/pedido/listar']);
      return;
    }

    this.pedidoForm = this.fb.group({
      solicitante: [this.pedidoOriginal.solicitante, Validators.required],
      setor_destino: [this.pedidoOriginal.setor_destino, Validators.required],
      responsavel_setor: [this.pedidoOriginal.responsavel_setor, Validators.required],
      itens: this.fb.array([])
    });

    this.itemService.listarItens().subscribe(itens => {
      this.itensDisponiveis = itens;
      this.preencherItens(); // Preenche os itens do pedido original
    });
  }

  get itens(): FormArray {
    return this.pedidoForm.get('itens') as FormArray;
  }

  getItensDisponiveisParaSelect(indexAtual: number): Item[] {
  const idsSelecionados = this.itensSelecionados.filter((_, i) => i !== indexAtual);
  return this.itensDisponiveis.filter(item => !idsSelecionados.includes(item.id));
}

preencherItens() {
  this.pedidoOriginal.itens.forEach((item: any, index: number) => {
    const itemEncontrado = this.itensDisponiveis.find(i => i.id === item.item);

    const grupo = this.fb.group({
      item: [item.item, Validators.required],
      quantidade_pedida: [item.quantidade_pedida, [Validators.required, Validators.min(1)]],
      quantidade_atual_estoque: [{ value: itemEncontrado?.quantidade_atual ?? 0, disabled: true }],
      ultima_entrada_estoque: [item.ultima_entrada_estoque,]
    });

    // Atualiza a quantidade e última entrada quando o item for alterado
    grupo.get('item')?.valueChanges.subscribe(itemId => {
      if (itemId) {
        this.pedidoComponent.atualizarEstoqueEEntrada(grupo, +itemId);
      } else {
        grupo.patchValue({ quantidade_atual_estoque: 0, ultima_entrada_estoque: null });
      }
    });

    this.itens.push(grupo);
    this.onItemSelecionado(index);
  });
}

adicionarItem() {
  const grupo = this.fb.group({
    item: [null, Validators.required],
    quantidade_pedida: [1, [Validators.required, Validators.min(1)]],
    quantidade_atual_estoque: [{ value: 0, disabled: true }],
    ultima_entrada_estoque: [null]
  });

  grupo.get('item')?.valueChanges.subscribe(itemId => {
    if (itemId) {
      this.pedidoComponent.atualizarEstoqueEEntrada(grupo, +itemId);
    } else {
      grupo.patchValue({ quantidade_atual_estoque: 0, ultima_entrada_estoque: null });
    }
  });

  this.itens.push(grupo);
  this.snackBar.show('Novo item adicionado ao pedido', 'success');
}

removerItem(index: number) {
  this.pedidoComponent.removerItem(
    index,
    this.itens,
    this.itensDisponiveis,
    this.snackBar,
    (ids) => this.itensSelecionados = ids
  );
}


  onItemSelecionado(index: number) {
    const itemId = this.itens.at(index).get('item')?.value;
    const itemSelecionado = this.itensDisponiveis.find(i => i.id === +itemId);

    if (itemSelecionado) {
      this.itens.at(index).patchValue({
        quantidade_atual_estoque: itemSelecionado.quantidade_atual
      });
    }
    // Atualiza e adiciona o item na lista de itens selecionados
    this.itensSelecionados = this.itens.controls
      .map(c => +c.get('item')?.value)
      .filter(v => !isNaN(v));
  }


atualizarPedido() {
  // Marca todos os campos como "touched" para exibir mensagens de erro
  this.pedidoForm.markAllAsTouched();

  // Verifica se o formulário é inválido
  if (this.pedidoForm.invalid) {
    this.snackBar.show('Por favor, preencha todos os campos obrigatórios', 'error');
    return;
  }

  // Verifica se há pelo menos um item no pedido
  if (this.itens.length === 0) {
    this.snackBar.show('Adicione ao menos um item no pedido', 'error');
    return;
  }

  // Se passou em todas as validações, envia a atualização
  const pedidoAtualizado = {
    ...this.pedidoForm.getRawValue(),
    id: this.pedidoOriginal.id
  };

  this.pedidoService.atualizarPedido(pedidoAtualizado.id, pedidoAtualizado).subscribe({
    next: () => {
      this.snackBar.show('Pedido atualizado com sucesso.', 'success');
      this.pedidoService.limparPedido(); // opcional
      this.router.navigate(['/pedido/listar']);
    },
    error: (err) => {
      this.snackBar.show('Erro ao atualizar pedido.', 'error');
      console.error(err);
    }
  });
}

abrirModalConfirmacao() {
  // Valida campos principais
  if (!this.pedidoForm.valid || this.itens.length === 0) {
    this.snackBar.show('Preencha todos os campos obrigatórios e adicione pelo menos 1 item', 'error');
    return;
  }

  const itensResumo = this.itens.controls.map(ctrl => ({
    nome: this.itensDisponiveis.find(i => i.id === +ctrl.get('item')?.value)?.nome ?? '',
    codigo: this.itensDisponiveis.find(i => i.id === +ctrl.get('item')?.value)?.codigo ?? '',
    quantidade_pedida: ctrl.get('quantidade_pedida')?.value ?? 0,
    quantidade_atual: ctrl.get('quantidade_atual_estoque')?.value ?? 0,
    ultima_entrada_estoque: ctrl.get('ultima_entrada_estoque')?.value || null
  }));

  this.pedidoResumo = {
    solicitante: this.pedidoForm.get('solicitante')?.value,
    setor_destino: this.pedidoForm.get('setor_destino')?.value,
    responsavel_setor: this.pedidoForm.get('responsavel_setor')?.value,
    itens: itensResumo
  };

  this.modalConfirmacaoAberto = true;
}


}
