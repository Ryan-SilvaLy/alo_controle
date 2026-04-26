import { Component, OnInit } from '@angular/core';
import { LogsService, Log } from '../../services/logs.service';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss'
})

export class LogsComponent implements OnInit {
  
  logs: Log[] = [];
  loading = true;
  error: string | null = null;

  constructor(private logsService: LogsService) {}

  ngOnInit(): void {
    this.logsService.listarLogs().subscribe({
      next: (data: Log[]) => {
        this.logs = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Erro ao carregar logs.';
        this.loading = false;
      }
    });
  }
}