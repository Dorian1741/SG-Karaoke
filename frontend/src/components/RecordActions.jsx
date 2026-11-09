import { useState } from 'react'
import { request } from '../api/client'
import { Alert, Modal } from './UI'

const nouns = {
  branches: 'sucursal',
  rooms: 'sala',
  rates: 'precio',
  members: 'persona del equipo',
}

export function TrashSwitch({ trashed, onChange }) {
  return (
    <div
      className="list-view-switch"
      role="group"
      aria-label="Vista del listado"
    >
      <button
        type="button"
        className={trashed ? 'secondary' : ''}
        aria-pressed={!trashed}
        onClick={() => onChange(false)}
      >
        Listado
      </button>
      <button
        type="button"
        className={trashed ? '' : 'secondary'}
        aria-pressed={trashed}
        onClick={() => onChange(true)}
      >
        Papelera
      </button>
    </div>
  )
}

export default function RecordActions({ resource, record, onChanged }) {
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const removed = Boolean(record.deleted_at || record.removed_at)
  const noun = nouns[resource]
  const canActivate = resource === 'branches' || resource === 'rooms'
  const titles = {
    delete: `Eliminar ${noun}`,
    restore: `Restaurar ${noun}`,
    activate: `Activar ${noun}`,
    deactivate: `Desactivar ${noun}`,
  }
  const descriptions = {
    delete:
      resource === 'members'
        ? `"${record.name}" dejará de pertenecer a este negocio y perderá el acceso. Su cuenta y sus otros establecimientos se conservarán. Podrás restaurar esta pertenencia desde la papelera.`
        : resource === 'rooms'
          ? `"${record.name}" pasará a la papelera y su precio vigente quedará desactivado. Se conservarán la sala y su historial de precios.`
          : resource === 'branches'
            ? `"${record.name}" pasará a la papelera. Para continuar, la sucursal debe estar sin salas en el listado.`
            : `"${record.name}" pasará a la papelera. Si es el precio vigente, la sala quedará sin precio actual hasta que configures otro. El importe y su historial se conservarán.`,
    restore:
      resource === 'members'
        ? `"${record.name}" volverá al equipo sin acceso habilitado. Después podrás revisar sus permisos y permitirle entrar.`
        : resource === 'rates'
          ? `"${record.name}" volverá al historial como precio anterior. El precio vigente de la sala seguirá igual.`
          : `"${record.name}" volverá al listado como registro inactivo. Después podrás activarlo. ${resource === 'rooms' ? 'La sucursal debe estar restaurada y activa.' : ''}`,
    activate: `"${record.name}" volverá a estar activo. ${resource === 'rooms' ? 'Su sucursal también debe estar activa.' : ''}`,
    deactivate: `"${record.name}" quedará inactivo y conservará toda su información. ${resource === 'branches' ? 'Primero debes desactivar o mover sus salas activas.' : 'Puedes activarlo nuevamente cuando esté listo.'}`,
  }
  function begin(next) {
    setError(null)
    setAction(next)
  }
  async function confirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await request(
        `/${resource}/${record.id}${action === 'delete' ? '' : `/${action}`}`,
        { method: action === 'delete' ? 'DELETE' : 'POST' },
      )
      const messages = {
        delete: `"${record.name}" se envió a la papelera. Su información se conserva.`,
        restore:
          resource === 'rates'
            ? `"${record.name}" se restauró en el historial, sin cambiar el precio vigente.`
            : `"${record.name}" se restauró. Revisa sus datos antes de ${resource === 'members' ? 'permitirle acceso' : 'activarlo'}.`,
        activate: `"${record.name}" está activo nuevamente.`,
        deactivate: `"${record.name}" se desactivó. Su información se conserva.`,
      }
      const completed = action
      setAction(null)
      onChanged(messages[completed], completed)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {removed ? (
        <button
          type="button"
          className="secondary"
          aria-label={`Restaurar ${record.name}`}
          onClick={() => begin('restore')}
        >
          Restaurar
        </button>
      ) : (
        <>
          {canActivate && (
            <button
              type="button"
              className="secondary"
              aria-label={`${record.is_active ? 'Desactivar' : 'Activar'} ${record.name}`}
              onClick={() =>
                begin(record.is_active ? 'deactivate' : 'activate')
              }
            >
              {record.is_active ? 'Desactivar' : 'Activar'}
            </button>
          )}
          <button
            type="button"
            className="danger"
            aria-label={`Eliminar ${record.name}`}
            onClick={() => begin('delete')}
          >
            Eliminar
          </button>
        </>
      )}
      {action && (
        <Modal
          title={titles[action]}
          description={descriptions[action]}
          busy={busy}
          initialFocus="cancel"
          onClose={() => setAction(null)}
        >
          <Alert error={error} />
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              data-cancel
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={action === 'delete' ? 'danger' : ''}
              disabled={busy}
              onClick={confirm}
            >
              {busy
                ? 'Procesando…'
                : action === 'delete'
                  ? 'Enviar a la papelera'
                  : action === 'restore'
                    ? 'Restaurar'
                    : action === 'activate'
                      ? 'Activar'
                      : 'Desactivar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
