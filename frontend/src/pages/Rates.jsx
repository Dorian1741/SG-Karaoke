import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOptions, request } from '../api/client'
import RecordActions, { TrashSwitch } from '../components/RecordActions'
import { useAuth } from '../auth/useAuth'
import {
  Alert,
  EmptyState,
  Field,
  FormActions,
  Loading,
  Modal,
  Notice,
  PageTitle,
  Pagination,
  Status,
} from '../components/UI'

export default function Rates() {
  const { tenant } = useAuth()
  const canManage = ['owner', 'admin'].includes(tenant.role)
  const [trashed, setTrashed] = useState(false)
  const [result, setResult] = useState(null)
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(null)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(null)
  const [page, setPage] = useState(1)
  const [roomFilter, setRoomFilter] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const activeRooms = rooms.filter(
    (room) =>
      room.is_active && room.branch?.is_active && !room.branch?.deleted_at,
  )
  const hasActiveRooms = activeRooms.length > 0
  useEffect(() => {
    const controller = new AbortController()
    getOptions('/rooms', controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setRooms(data)
          setOptionsError(null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setOptionsError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setRoomsLoading(false)
      })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    const controller = new AbortController()
    request(
      `/rates?page=${page}&per_page=15${roomFilter ? `&room_id=${roomFilter}` : ''}${trashed ? '&trashed=only' : ''}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data)
          setError(null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, roomFilter, revision, trashed])
  function refresh() {
    setError(null)
    setLoading(true)
    setRevision((value) => value + 1)
  }
  function changeView(value) {
    setTrashed(value)
    setPage(1)
    setRoomFilter('')
    refresh()
  }
  function changed(message) {
    setSuccess(message)
    setPage(1)
    refresh()
  }
  function openForm(record = {}) {
    setEditing(record)
    setFormError(null)
  }
  async function save(event) {
    event.preventDefault()
    const { room_id, ...body } = Object.fromEntries(
      new FormData(event.currentTarget),
    )
    body.hourly_price = body.hourly_price.trim().replace(',', '.')
    if (
      !window.confirm(
        `¿Guardar el precio de ${body.hourly_price} USD por hora? Si ya hay un precio vigente, pasará al historial y se conservará.`,
      )
    )
      return
    setBusy(true)
    setFormError(null)
    try {
      await request(
        editing.id ? `/rates/${editing.id}/replace` : `/rooms/${room_id}/rates`,
        { method: 'POST', body },
      )
      setSuccess(
        `Precio de ${body.hourly_price} USD por hora guardado. El precio anterior se conserva en el historial.`,
      )
      setEditing(null)
      refresh()
    } catch (cause) {
      setFormError(cause)
    } finally {
      setBusy(false)
    }
  }
  const fields = formError?.errors || {}
  return (
    <>
      <PageTitle
        title="Precios por hora"
        description="Define cuánto cuesta una hora en cada sala. Los precios anteriores quedan guardados."
      >
        {canManage && !trashed && (
          <button
            disabled={roomsLoading || !hasActiveRooms}
            onClick={() => openForm()}
          >
            + Nuevo precio
          </button>
        )}
      </PageTitle>
      <Notice onDismiss={() => setSuccess('')}>{success}</Notice>
      <Alert error={error || optionsError} />
      {(error || optionsError) && (
        <button className="secondary mb-5" onClick={refresh}>
          Volver a cargar
        </button>
      )}
      {!trashed &&
        !roomsLoading &&
        !optionsError &&
        !hasActiveRooms &&
        canManage && (
          <div className="help-banner">
            <div>
              <strong>Primero necesitas una sala activa</strong>
              <p>Después podrás asignarle su precio por hora.</p>
            </div>
            <Link className="button-link secondary" to="/rooms">
              Ir a salas
            </Link>
          </div>
        )}
      {canManage && <TrashSwitch trashed={trashed} onChange={changeView} />}
      {trashed && (
        <p className="muted mb-5">
          Los precios eliminados conservan su importe e historial. Restaurar un
          precio no lo convierte en el precio vigente.
        </p>
      )}
      <div className="filters">
        <Field label="Filtrar por sala">
          <select
            value={roomFilter}
            onChange={(event) => {
              setLoading(true)
              setPage(1)
              setRoomFilter(event.target.value)
            }}
          >
            <option value="">Todas las salas</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.branch?.name}
              </option>
            ))}
          </select>
        </Field>
        {roomFilter && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setLoading(true)
              setPage(1)
              setRoomFilter('')
            }}
          >
            Ver todas las salas
          </button>
        )}
      </div>
      {loading ? (
        <Loading>Cargando precios e historial…</Loading>
      ) : (
        !error && (
          <div className="card table-wrap">
            <table className="responsive-table">
              <caption className="sr-only">
                Precios vigentes y anteriores de las salas
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nombre del precio</th>
                  <th scope="col">Sala</th>
                  <th scope="col">Precio por hora</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha</th>
                  {canManage && <th scope="col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {result?.data.map((rate) => (
                  <tr key={rate.id}>
                    <td data-label="Nombre" className="record-name">
                      {rate.name}
                    </td>
                    <td data-label="Sala">{rate.room?.name}</td>
                    <td data-label="Precio por hora" className="font-medium">
                      {rate.hourly_price} {rate.currency}
                    </td>
                    <td data-label="Estado">
                      <Status
                        active={rate.is_active}
                        activeLabel="Vigente"
                        inactiveLabel={trashed ? 'En papelera' : 'Anterior'}
                      />
                    </td>
                    <td data-label="Fecha">
                      {new Date(rate.created_at).toLocaleDateString('es-EC', {
                        timeZone: tenant.timezone,
                      })}
                    </td>
                    {canManage && (
                      <td data-label="Acciones" className="actions-cell">
                        <div className="row-actions">
                          {!trashed && (
                            <button
                              type="button"
                              className="secondary"
                              disabled={
                                !activeRooms.some(
                                  (room) => room.id === rate.room_id,
                                )
                              }
                              aria-label={`${rate.is_active ? 'Cambiar precio' : 'Usar precio anterior'} de ${rate.room?.name}`}
                              onClick={() =>
                                openForm(
                                  rate.is_active ? rate : { ...rate, id: null },
                                )
                              }
                            >
                              {rate.is_active
                                ? 'Cambiar precio'
                                : 'Usar este precio'}
                            </button>
                          )}
                          <RecordActions
                            resource="rates"
                            record={rate}
                            onChanged={changed}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!result?.data.length && (
              <EmptyState
                title={
                  trashed
                    ? 'La papelera de precios está vacía'
                    : roomFilter
                      ? 'Esta sala todavía no tiene un precio'
                      : 'Configura el primer precio por hora'
                }
                description={
                  trashed
                    ? 'Aquí se conservan los precios que elimines.'
                    : 'Elige una sala y define su precio en dólares. Cada sala puede tener un solo precio vigente.'
                }
              >
                {canManage && !trashed && hasActiveRooms && (
                  <button onClick={() => openForm()}>Agregar un precio</button>
                )}
              </EmptyState>
            )}
          </div>
        )
      )}
      {!error && (
        <Pagination
          meta={result?.meta}
          disabled={loading}
          onPage={(value) => {
            setLoading(true)
            setPage(value)
          }}
        />
      )}
      {editing && (
        <Modal
          title={
            editing.id ? 'Cambiar precio por hora' : 'Nuevo precio por hora'
          }
          description={
            editing.id
              ? `Estás cambiando el precio de ${editing.room?.name}. El precio anterior se conservará en el historial.`
              : 'Elige una sala y el precio de una hora completa. Los campos con * son obligatorios.'
          }
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <Alert error={formError} />
          <form onSubmit={save} aria-busy={busy}>
            {!editing.id && (
              <Field
                label="Sala"
                hint="Solo aparecen las salas activas."
                error={fields.room_id}
              >
                <select
                  name="room_id"
                  required
                  defaultValue={editing.room_id || roomFilter || ''}
                >
                  <option value="" disabled>
                    Seleccionar sala
                  </option>
                  {activeRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} · {room.branch?.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field
              label="Nombre del precio"
              name="name"
              required
              maxLength={255}
              defaultValue={editing.name || 'Precio estándar'}
              hint="Un nombre para reconocerlo en el historial, por ejemplo: Precio estándar."
              error={fields.name}
            />
            <Field
              label="Precio por hora"
              name="hourly_price"
              type="text"
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]{0,9})(?:[.,][0-9]{1,2})?"
              placeholder="20,00"
              required
              defaultValue={editing.hourly_price || ''}
              hint="En dólares. Puedes escribir 20,00 o 20.00. No se admiten precios negativos."
              error={fields.hourly_price}
            />
            <Field
              label="Moneda"
              hint="Todos los precios se guardan en dólares estadounidenses."
            >
              <select name="currency">
                <option value="USD">USD — Dólar estadounidense</option>
              </select>
            </Field>
            <FormActions
              busy={busy}
              onCancel={() => setEditing(null)}
              label="Guardar precio"
            />
          </form>
        </Modal>
      )}
    </>
  )
}
