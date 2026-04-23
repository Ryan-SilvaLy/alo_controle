import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-pagination',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss'
})
export class PaginationComponent {
  @Input() totalItens = 0;
  @Input() itensPorPagina = 25;
  @Input() paginaAtual = 1;
  @Input() opcoesItensPorPagina = [10, 25, 50, 75, 100];

  @Output() paginaAtualChange = new EventEmitter<number>();
  @Output() itensPorPaginaChange = new EventEmitter<number>();

  get totalPaginas(): number {
    return Math.ceil(this.totalItens / this.itensPorPagina);
  }

  irParaPagina(pagina: number) {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaAtual = pagina;
    this.paginaAtualChange.emit(this.paginaAtual);
  }

  alterarItensPorPagina(valor: number) {
    this.itensPorPagina = valor;
    this.paginaAtual = 1;
    this.itensPorPaginaChange.emit(this.itensPorPagina);
    this.paginaAtualChange.emit(this.paginaAtual); 
  }


}
