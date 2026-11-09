import { useEffect, useState } from 'react'
import { request } from '../api/client'
import RecordActions, { TrashSwitch } from '../components/RecordActions'
import { useAuth } from '../auth/useAuth'
import { roleLabels } from '../auth/roles'
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
  PasswordField,
  Status,
} from '../components/UI'

const roleDescriptions = {
  owner: 'Puede administrar todo el negocio y cambiar los permisos del equipo.',
  admin:
    'Puede gestionar sucursales, salas y precios. No puede cambiar los permisos de otras personas.',
  employee:
    'Puede consultar las salas y sus precios. No puede cambiar la configuración del negocio.',
}
const timezones = [
  ['America/Guayaquil', 'Ecuador continental (Guayaquil)'],
  ['Pacific/Galapagos', 'Ecuador, islas Galápagos'],
  ['America/Bogota', 'Colombia'],
  ['America/Lima', 'Perú'],
  ['America/Mexico_City', 'México, Ciudad de México'],
  ['America/Santiago', 'Chile, Santiago'],
  ['America/Argentina/Buenos_Aires', 'Argentina, Buenos Aires'],
  ['UTC', 'Hora universal (UTC)'],
]

export default function Administration() {
  const { tenant, refresh } = useAuth()
  const isOwner = tenant.role === 'owner'
  const [trashed, setTrashed] = useState(false)
  const [members, setMembers] = useState(null)
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(null)
  const [selectedRole, setSelectedRole] = useState('employee')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!isOwner) return
    const controller = new AbortController()
    request(
      `/members?page=${page}&per_page=15${trashed ? '&trashed=only' : ''}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setMembers(data)
          setMembersError(null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setMembersError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setMembersLoading(false)
      })
    return () => controller.abort()
  }, [isOwner, page, revision, trashed])
  function reloadMembers() {
    setMembersError(null)
    setMembersLoading(true)
    setRevision((value) => value + 1)
  }
  function changeView(value) {
    setTrashed(value)
    setPage(1)
    reloadMembers()
  }
  function changed(message) {
    setSuccess(message)
    setPage(1)
    reloadMembers()
    refresh().catch(setError)
  }
  function openMember(member = {}) {
    setEditing(member)
    setSelectedRole(member.role || 'employee')
    setFormError(null)
  }
  async function saveTenant(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setError(null)
    setSuccess('')
    try {
      await request('/tenant', { method: 'PATCH', body })
      await refresh()
      setSuccess('La información de tu negocio se actualizó correctamente.')
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }
  async function saveMember(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    if (body.email) body.email = body.email.trim().toLowerCase()
    if (!body.password) delete body.password
    if (editing.id) body.is_active = body.is_active === 'true'
    if (
      editing.id &&
      !window.confirm(
        `¿Guardar los permisos de ${editing.name}? ${body.is_active ? `Su acceso será de ${roleLabels[body.role].toLowerCase()}.` : 'Esta persona ya no podrá acceder a este establecimiento.'}`,
      )
    )
      return
    setBusy(true)
    setFormError(null)
    try {
      await request(`/members${editing.id ? `/${editing.id}` : ''}`, {
        method: editing.id ? 'PATCH' : 'POST',
        body,
      })
      setSuccess(
        editing.id
          ? `Los permisos de ${editing.name} se actualizaron.`
          : `${body.name} ya forma parte de tu equipo.`,
      )
      setEditing(null)
      await refresh()
      reloadMembers()
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
        title="Mi negocio y equipo"
        description="Consulta los datos de tu establecimiento y quién tiene acceso."
      />
      <Notice onDismiss={() => setSuccess('')}>{success}</Notice>
      <Alert error={error} />
      <section className="card" aria-labelledby="business-title">
        <div className="section-heading">
          <div>
            <h2 id="business-title">Datos de mi negocio</h2>
            <p className="muted">
              Tu acceso actual es de {roleLabels[tenant.role].toLowerCase()}.
            </p>
          </div>
        </div>
        <form onSubmit={saveTenant} aria-busy={busy}>
          <div className="grid md:grid-cols-2 gap-5">
            <Field
              label="Nombre del negocio"
              name="name"
              defaultValue={tenant.name}
              required
              maxLength={255}
              disabled={!isOwner}
              error={error?.errors?.name}
            />
            <Field
              label="Zona horaria"
              hint="Las fechas de los precios se muestran según la zona de tu negocio."
              error={error?.errors?.timezone}
            >
              <select
                name="timezone"
                defaultValue={tenant.timezone}
                disabled={!isOwner}
                required
              >
                {!timezones.some(([value]) => value === tenant.timezone) && (
                  <option value={tenant.timezone}>
                    {tenant.timezone} (actual)
                  </option>
                )}
                {timezones.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {isOwner ? (
            <button disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar datos del negocio'}
            </button>
          ) : (
            <p className="field-hint">
              El propietario puede cambiar estos datos.
            </p>
          )}
        </form>
      </section>
      {isOwner ? (
        <section className="mt-8" aria-labelledby="team-title">
          <div className="section-heading">
            <div>
              <h2 id="team-title">Mi equipo</h2>
              <p className="muted">
                Cada persona tiene su propio acceso. Elige qué puede hacer en tu
                negocio.
              </p>
            </div>
            {!trashed && (
              <button onClick={() => openMember()}>+ Agregar persona</button>
            )}
          </div>
          <TrashSwitch trashed={trashed} onChange={changeView} />
          {trashed && (
            <p className="muted mb-5">
              Estas personas ya no tienen acceso a este negocio. Restaurarlas
              las devuelve al equipo sin habilitarles el acceso.
            </p>
          )}
          <Alert error={membersError} />
          {membersError && (
            <button
              type="button"
              className="secondary mb-5"
              onClick={reloadMembers}
            >
              Volver a cargar el equipo
            </button>
          )}
          {membersLoading ? (
            <Loading>Cargando tu equipo…</Loading>
          ) : (
            !membersError && (
              <div className="card table-wrap">
                <table className="responsive-table">
                  <caption className="sr-only">
                    Personas con acceso al establecimiento y sus permisos
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Permisos</th>
                      <th scope="col">Acceso</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members?.data.map((member) => (
                      <tr key={member.id}>
                        <td data-label="Nombre" className="record-name">
                          {member.name}
                        </td>
                        <td data-label="Correo">{member.email}</td>
                        <td data-label="Permisos">{roleLabels[member.role]}</td>
                        <td data-label="Acceso">
                          <Status
                            active={member.is_active && member.user_is_active}
                            activeLabel="Permitido"
                            inactiveLabel="Sin acceso"
                          />
                        </td>
                        <td data-label="Acciones" className="actions-cell">
                          <div className="row-actions">
                            {!trashed && (
                              <button
                                type="button"
                                className="secondary"
                                aria-label={`Cambiar permisos de ${member.name}`}
                                onClick={() => openMember(member)}
                              >
                                Cambiar permisos
                              </button>
                            )}
                            <RecordActions
                              resource="members"
                              record={member}
                              onChanged={changed}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {members?.data.length === 0 && (
                  <EmptyState
                    title={
                      trashed
                        ? 'La papelera del equipo está vacía'
                        : 'Todavía no hay personas en esta lista'
                    }
                    description={
                      trashed
                        ? 'Aquí aparecerán las pertenencias que elimines de este negocio.'
                        : 'Agrega a las personas que trabajan contigo y elige sus permisos.'
                    }
                  />
                )}
              </div>
            )
          )}
          {!membersError && (
            <Pagination
              meta={members?.meta}
              disabled={membersLoading || busy}
              onPage={(value) => {
                setMembersLoading(true)
                setPage(value)
              }}
            />
          )}
        </section>
      ) : (
        <p className="help-banner mt-8">
          El propietario puede agregar personas y cambiar los permisos del
          equipo.
        </p>
      )}
      {editing && (
        <Modal
          title={
            editing.id
              ? `Permisos de ${editing.name}`
              : 'Agregar una persona al equipo'
          }
          description={
            editing.id
              ? 'Los cambios solo afectan al acceso de esta persona a tu establecimiento.'
              : 'Los campos con * son obligatorios. Cada persona entra con su propio correo y contraseña.'
          }
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <Alert error={formError} />
          <form onSubmit={saveMember} aria-busy={busy}>
            {!editing.id && (
              <>
                <Field
                  label="Nombre"
                  name="name"
                  required
                  maxLength={255}
                  placeholder="Nombre de la persona"
                  error={fields.name}
                />
                <Field
                  label="Correo electrónico"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  error={fields.email}
                />
                <PasswordField
                  label="Contraseña inicial"
                  name="password"
                  autoComplete="new-password"
                  minLength={12}
                  optional
                  hint="Solo para cuentas nuevas: al menos 12 caracteres, con mayúsculas, minúsculas y números. Si ya usa KaraokeOS, deja este campo vacío para conservar su contraseña."
                  error={fields.password}
                />
              </>
            )}
            <Field
              label="Permisos"
              hint={roleDescriptions[selectedRole]}
              error={fields.role}
            >
              <select
                name="role"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                required
              >
                {Object.entries(roleLabels).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
            {editing.id && (
              <Field
                label="Acceso al establecimiento"
                hint="Quitar el acceso conserva la información y no elimina la cuenta."
                error={fields.is_active}
              >
                <select
                  name="is_active"
                  defaultValue={String(editing.is_active)}
                >
                  <option value="true">Permitir acceso</option>
                  <option value="false">Quitar acceso</option>
                </select>
              </Field>
            )}
            <FormActions
              busy={busy}
              onCancel={() => setEditing(null)}
              label={editing.id ? 'Guardar permisos' : 'Agregar persona'}
            />
          </form>
        </Modal>
      )}
    </>
  )
}
