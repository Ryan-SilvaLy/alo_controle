import { Item } from './../../services/item.service';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ControleService } from '../../services/controle.service';
import { FormArray, FormGroup } from '@angular/forms';
import { SnackbarService } from '../../shared/snackbar/snackbar.service';


@Component({
  selector: 'app-pedido',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './pedido.component.html',
  styleUrl: './pedido.component.scss'
})
export class PedidoComponent {


    itensDisponiveis: Item[] = []; // precisa popular no pai

  constructor(private controleService: ControleService) {}

  atualizarEstoqueEEntrada(grupo: FormGroup, itemId: number) {
    const itemSelecionado = this.itensDisponiveis.find(i => i.id === +itemId);

    grupo.patchValue({
      quantidade_atual_estoque: itemSelecionado ? itemSelecionado.quantidade_atual : 0,
      ultima_entrada_estoque: null,
    });

    this.controleService.buscarUltimaEntradaEstoque(+itemId).subscribe({
      next: res => {
        if (res.data && !res.data.includes('Não há registros')) {
          const iso = new Date(res.data).toISOString().substring(0, 10);
          grupo.patchValue({ ultima_entrada_estoque: iso });
        } else {
          grupo.patchValue({ ultima_entrada_estoque: null });
        }
      },
      error: () => {
        grupo.patchValue({ ultima_entrada_estoque: null });
      }
    });
  }


removerItem(
  index: number,
  itens: FormArray,
  itensDisponiveis: Item[],
  snackBar: SnackbarService,
  atualizarSelecionados: (ids: number[]) => void
) {
  itens.removeAt(index);

  // Atualiza lista de selecionados
  const selecionados = itens.controls
    .map(c => +c.get('item')?.value)
    .filter(v => !isNaN(v));
  atualizarSelecionados(selecionados);

  // Atualiza selects dos grupos restantes
  itens.controls.forEach(grupo => {
    const itemId = grupo.get('item')?.value;
    grupo.patchValue({
      quantidade_atual_estoque: itemId ? itensDisponiveis.find(it => it.id === +itemId)?.quantidade_atual ?? 0 : 0,
      ultima_entrada_estoque: itemId ? grupo.get('ultima_entrada_estoque')?.value : null
    }, { emitEvent: false });
  });

  snackBar.show('Item removido do pedido', 'error');
}

}

