import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PedidoResumo {
  solicitante: string;
  setor_destino: string;
  responsavel_setor: string;
  itens: { 
    nome: string; 
    codigo: string; 
    quantidade_pedida: number; 
    quantidade_atual: number; 
    ultima_entrada_estoque: string | null; 
  }[];
}


@Component({
  selector: 'app-modal-confirmar-pedido',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-confirmar-pedido.component.html',
  styleUrl: './modal-confirmar-pedido.component.scss'
})
export class ModalConfirmarPedidoComponent {


    @Input() aberto: boolean = false;
  @Input() pedido!: PedidoResumo;

  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  onConfirmar() {
    this.confirmar.emit();
  }

  onCancelar() {
    this.cancelar.emit();
  }

}
