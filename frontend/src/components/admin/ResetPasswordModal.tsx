import { useEffect, useState, type FormEvent } from 'react';
import { usuariosService } from '../../services/usuariosService';
import { mensajeDeError } from '../mostrador/avisos';
import AdminIcon from './AdminIcon';

interface Props {
  usuarioId: number;
  nombrePersona: string;
  nombreUsuario?: string | null;
  onCerrar: () => void;
  onGuardada: (aviso: string) => void;
}

export default function ResetPasswordModal({
  usuarioId,
  nombrePersona,
  nombreUsuario,
  onCerrar,
  onGuardada,
}: Props) {
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && !guardando && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar, guardando]);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passwordNueva.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordNueva !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setGuardando(true);
    try {
      await usuariosService.restablecerPassword(usuarioId, passwordNueva);
      onGuardada(
        `Se actualizó la contraseña de ${nombrePersona}${nombreUsuario ? ` (@${nombreUsuario})` : ''}.`,
      );
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo restablecer la contraseña.'));
      setGuardando(false);
    }
  };

  return (
    <div className="reservation-modal-backdrop" role="presentation" style={{ zIndex: 1100 }}>
      <section
        className="reservation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-pass-title"
      >
        <button className="modal-close" onClick={onCerrar} aria-label="Cerrar" disabled={guardando}>
          <AdminIcon name="close" size={18} />
        </button>
        <span className="eyebrow">BLANQUEO DE CLAVE</span>
        <h2 id="reset-pass-title">Restablecer contraseña</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {nombrePersona}
          {nombreUsuario ? (
            <>
              {' '}
              (<strong className="mono" style={{ color: 'var(--ink)' }}>@{nombreUsuario}</strong>)
            </>
          ) : null}
          . Pasale la contraseña nueva por un canal seguro.
        </p>

        <form className="libro-form" onSubmit={guardar} noValidate>
          <div className="libro-form-campos" style={{ gridTemplateColumns: '1fr' }}>
            <label>
              Nueva contraseña (mínimo 8 caracteres)
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  value={passwordNueva}
                  onChange={(e) => {
                    setPasswordNueva(e.target.value);
                    setError(null);
                  }}
                  style={{ width: '100%', paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                  style={{
                    position: 'absolute',
                    right: 10,
                    background: 'transparent',
                    border: 0,
                    padding: 4,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                  }}
                >
                  {verClave ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <path d="m1 1 22 22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <label>
              Confirmar nueva contraseña
              <input
                type={verClave ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmacion}
                onChange={(e) => {
                  setConfirmacion(e.target.value);
                  setError(null);
                }}
              />
            </label>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <button
              type="submit"
              className="confirm-reservation"
              disabled={guardando}
              style={{ width: '100%', marginTop: 0, borderRadius: 0 }}
            >
              {guardando ? 'GUARDANDO…' : 'GUARDAR NUEVA CONTRASEÑA'}
            </button>
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              style={{
                width: '100%',
                padding: '14px 18px',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 0,
                background: '#e5e2dc',
                color: '#3d433f',
                border: '1px solid #c9c4ba',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}