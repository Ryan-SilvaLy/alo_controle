import { PedidoResumo, ModalConfirmarPedidoComponent } from './../modal-confirmar-pedido/modal-confirmar-pedido.component';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { PedidoService } from '../../../services/pedido.service';
import { ItemService, Item } from '../../../services/item.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { PedidoComponent } from '../pedido.component';

@Component({
  selector: 'app-criar-pedido',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalConfirmarPedidoComponent],
  templateUrl: './criar-pedido.component.html',
  styleUrl: './criar-pedido.component.scss'
})
export class CriarPedidoComponent implements OnInit {
  pedidoForm!: FormGroup;
  itensDisponiveis: Item[] = [];
  itensSelecionados: number[] = [];
  modalConfirmacaoAberto = false;
  pedidoResumo!: PedidoResumo;

  constructor(
    private fb: FormBuilder,
    private pedidoService: PedidoService,
    private itemService: ItemService,
    private router: Router,
    private snackBar: SnackbarService,
    private pedidoComponent: PedidoComponent
  ) {}

  ngOnInit() {
    this.pedidoForm = this.fb.group({
      solicitante: ['', Validators.required],
      setor_destino: ['', Validators.required],
      responsavel_setor: ['', Validators.required],
      itens: this.fb.array([])
    });

    this.itemService.listarItens().subscribe(itens => {
      this.itensDisponiveis = itens;
      this.pedidoComponent.itensDisponiveis = itens;
      this.adicionarItem();
    });
  }

  get itens(): FormArray {
    return this.pedidoForm.get('itens') as FormArray;
  }

  getItensDisponiveisParaSelect(indexAtual: number): Item[] {
    const idsSelecionados = this.itensSelecionados.filter((_, i) => i !== indexAtual);
    const grupoBaseId = this.getGrupoBaseId(indexAtual);

    return this.itensDisponiveis.filter(item => {
      const itemAindaDisponivel = !idsSelecionados.includes(item.id);
      const mesmoGrupo = !grupoBaseId || item.tipo_item?.id === grupoBaseId;
      return itemAindaDisponivel && mesmoGrupo;
    });
  }

  adicionarItem() {
    const grupo = this.fb.group({
      item: [null, Validators.required],
      quantidade_pedida: [1, [Validators.required, Validators.min(1)]],
      quantidade_atual_estoque: [{ value: 0, disabled: true }],
      ultima_entrada_estoque: ['']
    });

    this.itens.push(grupo);
    const indexDoGrupo = this.itens.length - 1;

    grupo.get('item')?.valueChanges.subscribe(itemId => {
      if (!itemId) {
        grupo.patchValue({ quantidade_atual_estoque: 0, ultima_entrada_estoque: '' });
        this.atualizarItensSelecionados();
        return;
      }

      if (!this.validarGrupoDoItem(+itemId, indexDoGrupo)) {
        grupo.patchValue(
          {
            item: null,
            quantidade_atual_estoque: 0,
            ultima_entrada_estoque: ''
          },
          { emitEvent: false }
        );
        this.atualizarItensSelecionados();
        return;
      }

      this.pedidoComponent.atualizarEstoqueEEntrada(grupo, +itemId);
      this.atualizarItensSelecionados();
    });

    this.atualizarItensSelecionados();
    this.snackBar.show('Novo item adicionado ao pedido', 'success');
  }

  removerItem(index: number) {
    this.pedidoComponent.removerItem(
      index,
      this.itens,
      this.itensDisponiveis,
      this.snackBar,
      ids => (this.itensSelecionados = ids)
    );
    this.atualizarItensSelecionados();
  }

  onItemSelecionado(index: number) {
    if (index < 0 || index >= this.itens.length) return;

    const grupo = this.itens.at(index) as FormGroup;
    const itemId = grupo.get('item')?.value;
    if (!itemId) {
      this.atualizarItensSelecionados();
      return;
    }

    if (!this.validarGrupoDoItem(+itemId, index)) {
      grupo.patchValue({
        item: null,
        quantidade_atual_estoque: 0,
        ultima_entrada_estoque: ''
      });
      this.atualizarItensSelecionados();
      return;
    }

    this.pedidoComponent.atualizarEstoqueEEntrada(grupo, +itemId);
    this.atualizarItensSelecionados();
  }

  enviarPedido() {
    this.pedidoForm.markAllAsTouched();

    if (this.pedidoForm.invalid) {
      this.snackBar.show('Por favor, preencha todos os campos obrigatorios', 'error');
      return;
    }

    if (this.itens.length === 0) {
      this.snackBar.show('Adicione ao menos um item no pedido', 'error');
      return;
    }

    if (this.getQuantidadeTiposSelecionados() > 1) {
      this.snackBar.show('Todos os itens do pedido devem pertencer ao mesmo grupo', 'error');
      return;
    }

    const pedido = this.pedidoForm.getRawValue();
    this.pedidoService.criarPedido(pedido).subscribe({
      next: res => {
        this.snackBar.show(`Pedido criado com sucesso! Codigo: ${res.codigo_pedido}`, 'success');
        this.router.navigate(['/pedido/listar']);
      },
      error: err => {
        this.snackBar.show('Erro ao criar pedido', 'error');
        console.error(err);
      }
    });
  }

  abrirModalConfirmacao() {
    const itensResumo = this.itens.controls.map(ctrl => ({
      nome: this.itensDisponiveis.find(i => i.id === +ctrl.get('item')?.value)?.nome ?? '',
      codigo: this.itensDisponiveis.find(i => i.id === +ctrl.get('item')?.value)?.codigo ?? '',
      quantidade_pedida: ctrl.get('quantidade_pedida')?.value ?? 0,
      quantidade_atual: ctrl.get('quantidade_atual_estoque')?.value ?? 0,
      ultima_entrada_estoque: ctrl.get('ultima_entrada_estoque')?.value
    }));

    this.pedidoResumo = {
      solicitante: this.pedidoForm.get('solicitante')?.value,
      setor_destino: this.pedidoForm.get('setor_destino')?.value,
      responsavel_setor: this.pedidoForm.get('responsavel_setor')?.value,
      itens: itensResumo
    };

    this.modalConfirmacaoAberto = true;
  }

  getItemSelecionado(index: number): Item | undefined {
    const itemId = +(this.itens.at(index)?.get('item')?.value ?? 0);
    return this.itensDisponiveis.find(item => item.id === itemId);
  }

  getNomeItemSelecionado(index: number): string {
    const item = this.getItemSelecionado(index);
    if (!item) {
      return 'Selecione um item';
    }

    return item.nome;
  }

  getQuantidadeTotalPedida(): number {
    return this.itens.controls.reduce((total, ctrl) => {
      const quantidade = Number(ctrl.get('quantidade_pedida')?.value ?? 0);
      return total + (Number.isFinite(quantidade) ? quantidade : 0);
    }, 0);
  }

  getItensEmBaixaSelecionados(): number {
    return this.itens.controls.reduce((total, _, index) => {
      const item = this.getItemSelecionado(index);
      return total + (item?.situacao === 'baixo' ? 1 : 0);
    }, 0);
  }

  getQuantidadeTiposSelecionados(): number {
    const tipos = new Set(
      this.itens.controls
        .map((_, index) => this.getItemSelecionado(index)?.tipo_item?.nome)
        .filter((tipo): tipo is string => !!tipo)
    );
    return tipos.size;
  }

  getUnidadeMedidaLabel(unidade: string | undefined): string {
    if (!unidade) {
      return 'Unidade nao informada';
    }

    const encontrada = this.itemService.UNIDADE_MEDIDA_CHOICES.find(([valor]) => valor === unidade);
    return encontrada?.[1] ?? unidade;
  }

  getResumoItensSelecionados() {
    return this.itens.controls
      .map((ctrl, index) => {
        const item = this.getItemSelecionado(index);
        if (!item) {
          return null;
        }

        return {
          nome: item.nome,
          codigo: item.codigo,
          tipo: item.tipo_item?.nome || 'Sem grupo',
          quantidade: Number(ctrl.get('quantidade_pedida')?.value ?? 0)
        };
      })
      .filter((item): item is { nome: string; codigo: string; tipo: string; quantidade: number } => item !== null);
  }

  getGrupoSelecionadoNome(): string {
    const grupoBaseId = this.getGrupoBaseId();
    if (!grupoBaseId) {
      return 'Definido pelo primeiro item selecionado';
    }

    const item = this.itensDisponiveis.find(itemDisponivel => itemDisponivel.tipo_item?.id === grupoBaseId);
    return item?.tipo_item?.nome || 'Grupo nao identificado';
  }

  temGrupoDefinido(): boolean {
    return !!this.getGrupoBaseId();
  }

  podeAdicionarMaisItens(): boolean {
    return !this.temGrupoDefinido() || this.getItensDisponiveisParaSelect(this.itens.length).length > 0;
  }

  private atualizarItensSelecionados() {
    this.itensSelecionados = this.itens.controls
      .map(ctrl => Number(ctrl.get('item')?.value))
      .filter(itemId => !Number.isNaN(itemId) && itemId > 0);
  }

  private getGrupoBaseId(indexIgnorado?: number): number | null {
    for (let index = 0; index < this.itens.length; index++) {
      if (index === indexIgnorado) {
        continue;
      }

      const itemSelecionado = this.getItemSelecionado(index);
      if (itemSelecionado?.tipo_item?.id) {
        return itemSelecionado.tipo_item.id;
      }
    }

    return null;
  }

  private validarGrupoDoItem(itemId: number, indexAtual: number): boolean {
    const itemSelecionado = this.itensDisponiveis.find(item => item.id === itemId);
    const grupoBaseId = this.getGrupoBaseId(indexAtual);

    if (!itemSelecionado?.tipo_item?.id) {
      this.snackBar.show('Esse item nao possui grupo vinculado e nao pode entrar no pedido', 'error');
      return false;
    }

    if (!grupoBaseId || itemSelecionado.tipo_item.id === grupoBaseId) {
      return true;
    }

    this.snackBar.show('Todos os itens do pedido precisam ser do mesmo grupo', 'error');
    return false;
  }
}
