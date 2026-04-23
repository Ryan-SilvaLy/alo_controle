import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';


/**
 * `AppConfig`: Serve para centralizar toda configuração da aplicação Angular, quando se trabalha utilizando o `bootstrap standalone` (sem `AppModule`)
 * 
 */

export const appConfig: ApplicationConfig = {
  // Sempre configurar o HttpClient aqui, se estiver dando esse erro no console:   NullInjectorError: No provider for _HttpClient!

  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(), // Provide para o HttpClient.
    importProvidersFrom(FormsModule)
  ]
};
