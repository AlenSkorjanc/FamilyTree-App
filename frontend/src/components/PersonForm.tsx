import { useState, type MouseEvent } from 'react'
import { useForm } from 'react-hook-form'
import type { Person, PersonInput } from '../types'
import { useI18n } from '../i18n'
import { resolvePhotoUrl } from '../api'

const emptyValues: PersonInput = {
  firstName: '', middleName: null, lastName: null, maidenName: null, gender: null,
  birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, photoUrl: null, notes: null,
}

interface Props { person?: Person; initialValues?: Partial<PersonInput>; submitLabel?: string; busy?: boolean; error?: string | null; onSubmit: (input: PersonInput, photoFile?: File) => void }

export function PersonForm({ person, initialValues, submitLabel, busy, error, onSubmit }: Props) {
  const { t } = useI18n()
  const [photoFile, setPhotoFile] = useState<File>()
  const { register, handleSubmit, formState: { errors } } = useForm<PersonInput>({ defaultValues: person ?? { ...emptyValues, ...initialValues } })
  const normalize = (input: PersonInput): PersonInput => Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
  ) as unknown as PersonInput

  return (
    <form className="person-form" onSubmit={handleSubmit((value) => onSubmit(normalize(value), photoFile))}>
      <div className="form-grid">
        <label>{t('firstName')} *<input autoFocus {...register('firstName', { required: t('firstNameRequired') })} />{errors.firstName && <em>{errors.firstName.message}</em>}</label>
        <label>{t('middleName')}<input {...register('middleName')} /></label>
        <label>{t('lastName')}<input {...register('lastName')} /></label>
        <label>{t('maidenName')}<input {...register('maidenName')} /></label>
        <label>{t('gender')}<select {...register('gender')}><option value="">{t('chooseGender')}</option><option value="MALE">{t('male')}</option><option value="FEMALE">{t('female')}</option></select></label>
        <span />
        <label>{t('birthDate')}<input type="date" {...register('birthDate')} onClick={openDatePicker} /></label>
        <label>{t('deathDate')}<input type="date" {...register('deathDate')} onClick={openDatePicker} /></label>
        <label>{t('birthPlace')}<input {...register('birthPlace')} /></label>
        <label>{t('deathPlace')}<input {...register('deathPlace')} /></label>
        <label className="full photo-upload">{t('photo')}
          {person?.photoUrl && <img src={resolvePhotoUrl(person.photoUrl)} alt={t('currentPhoto')} />}
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0])} />
          <small>{t('photoHelp')}</small>
        </label>
        <label className="full">{t('notes')}<textarea rows={4} {...register('notes')} /></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer><button className="primary" disabled={busy}>{busy ? t('saving') : submitLabel ?? t('savePerson')}</button></footer>
    </form>
  )
}

function openDatePicker(event: MouseEvent<HTMLInputElement>) {
  event.currentTarget.showPicker?.()
}
