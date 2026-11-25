import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { Session } from "./session";

interface Publicacion {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  modalidad: 'DONACION' | 'INTERCAMBIO';
  estado: 'DISPONIBLE' | 'RESERVADA' | 'ENTREGADA' | 'CANCELADA';
  propietario: string;
}

@Component({
  selector: 'app-root',
  imports: [Session],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly publicaciones = signal<Publicacion[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal(false);

  ngOnInit() {
    this.cargar();
  }

  protected cargar() {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(false);
    this.http.get<Publicacion[]>('/api/publicaciones').pipe(
      finalize(() => this.cargando.set(false)),
    ).subscribe({
      next: publicaciones => this.publicaciones.set(publicaciones),
      error: () => this.error.set(true),
    });
  }
}
