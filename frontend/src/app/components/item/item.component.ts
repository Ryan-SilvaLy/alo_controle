import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-item',
  standalone:true,
  imports: [CommonModule, RouterModule],
  templateUrl: './item.component.html',
  styleUrl: './item.component.scss'
})
export class ItemComponent {

gerarCodigoItem(): string {
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += Math.floor(Math.random() * 10).toString();
  }
  return codigo;
}


}
