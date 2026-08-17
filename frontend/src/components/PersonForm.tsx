import { useForm } from 'react-hook-form'
import type { Person, PersonInput } from '../types'

const emptyValues: PersonInput = {
  firstName: '', middleName: null, lastName: null, maidenName: null, gender: null,
  birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, photoUrl: null, notes: null,
}

interface Props { person?: Person; submitLabel?: string; busy?: boolean; error?: string | null; onSubmit: (input: PersonInput) => void }

export function PersonForm({ person, submitLabel = 'Save person', busy, error, onSubmit }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<PersonInput>({ defaultValues: person ?? emptyValues })
  const normalize = (input: PersonInput): PersonInput => Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
  ) as unknown as PersonInput

  return (
    <form className="person-form" onSubmit={handleSubmit((value) => onSubmit(normalize(value)))}>
      <div className="form-grid">
        <label>First name *<input autoFocus {...register('firstName', { required: 'First name is required' })} />{errors.firstName && <em>{errors.firstName.message}</em>}</label>
        <label>Middle name<input {...register('middleName')} /></label>
        <label>Last name<input {...register('lastName')} /></label>
        <label>Maiden name<input {...register('maidenName')} /></label>
        <label>Gender<input {...register('gender')} placeholder="Optional" /></label>
        <span />
        <label>Birth date<input type="date" {...register('birthDate')} /></label>
        <label>Death date<input type="date" {...register('deathDate')} /></label>
        <label>Birth place<input {...register('birthPlace')} /></label>
        <label>Death place<input {...register('deathPlace')} /></label>
        <label className="full">Photo URL<input type="url" {...register('photoUrl')} /></label>
        <label className="full">Notes<textarea rows={4} {...register('notes')} /></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer><button className="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></footer>
    </form>
  )
}
