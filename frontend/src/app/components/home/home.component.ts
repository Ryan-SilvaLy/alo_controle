import { Component, OnInit } from '@angular/core';
import { Item, ItemService } from '../../services/item.service'; // <-- ajuste aqui
import { Router, RouterModule } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';



@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {

  constructor (
    private itemService: ItemService,
    private router: Router,
    private authService: AuthenticationService
  ) { }


  ngOnInit(): void {
  }
}
