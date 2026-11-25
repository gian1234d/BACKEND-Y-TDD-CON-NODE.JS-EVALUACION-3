import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

interface Usuario {
  id: number;
  nombre: string;
  rol: 'USUARIO' | 'ADMIN';
}

interface Sesion {
  token: string;
  usuario: Usuario;
}

const storageKey = 'reuse-campus-token';

@Component({
  selector: 'app-session',
  imports: [FormsModule],
  templateUrl: './session.html',
})
export class Session implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly registrando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected nombre = '';
  protected correo = '';
  protected password = '';

  ngOnInit() {
    const token = sessionStorage.getItem(storageKey);
    if (!token) return;
    void this.ejecutar(async () => {
      const usuario = await firstValueFrom(this.http.get<Usuario>('/api/sesion', {
        headers: { Authorization: 'Bearer ' + token },
      }));
      this.usuario.set(usuario);
    });
  }

  protected cambiarModo() {
    this.registrando.update(value => !value);
    this.password = '';
    this.error.set('');
    this.aviso.set('');
  }

  protected enviar() {
    void this.ejecutar(async () => {
      const datos = { correo: this.correo, password: this.password };
      if (this.registrando()) {
        await firstValueFrom(this.http.post('/api/registro', { ...datos, nombre: this.nombre }));
        this.registrando.set(false);
        this.aviso.set('Cuenta creada. Ya puedes iniciar sesión.');
      } else {
        const sesion = await firstValueFrom(this.http.post<Sesion>('/api/sesion', datos));
        sessionStorage.setItem(storageKey, sesion.token);
        this.usuario.set(sesion.usuario);
        this.correo = '';
      }
      this.password = '';
    });
  }

  protected salir() {
    void this.ejecutar(async () => {
      const token = sessionStorage.getItem(storageKey);
      await firstValueFrom(this.http.delete('/api/sesion', {
        headers: { Authorization: 'Bearer ' + token },
      }));
      this.limpiarSesion();
    });
  }

  private limpiarSesion() {
    sessionStorage.removeItem(storageKey);
    this.usuario.set(null);
  }

  private async ejecutar(operacion: () => Promise<void>) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.aviso.set('');
    try {
      await operacion();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.limpiarSesion();
      this.error.set(error instanceof HttpErrorResponse
        ? error.error?.error || (error.status === 0 ? 'No hay conexión con la API.' : 'La operación falló.')
        : 'La operación falló.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
