import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { Person, PersonInput } from '../types'
import { useI18n } from '../i18n'
import { resolvePhotoUrl } from '../api'
import { DatePicker } from './DatePicker'

const emptyValues: PersonInput = {
  firstName: '', middleName: null, lastName: null, maidenName: null, gender: null,
  birthDate: null, deathDate: null, birthPlace: null, deathPlace: null, photoUrl: null, notes: null,
}

interface Props { person?: Person; initialValues?: Partial<PersonInput>; birthDatePickerAnchor?: string; submitLabel?: string; busy?: boolean; error?: string | null; autoFocusFirstField?: boolean; onSubmit: (input: PersonInput, photoFile?: File) => void; onCancel?: () => void }

export function PersonForm({ person, initialValues, birthDatePickerAnchor, submitLabel, busy, error, autoFocusFirstField = true, onSubmit, onCancel }: Props) {
  const { t } = useI18n()
  const [photoFile, setPhotoFile] = useState<File>()
  const [additionalDetailsOpen, setAdditionalDetailsOpen] = useState(() => Boolean(person?.middleName || person?.maidenName || person?.deathDate || person?.deathPlace))
  const { register, control, handleSubmit, formState: { errors } } = useForm<PersonInput>({ defaultValues: person ?? { ...emptyValues, ...initialValues } })
  const normalize = (input: PersonInput): PersonInput => Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
  ) as unknown as PersonInput

  return (
    <form className="person-form" onSubmit={handleSubmit((value) => onSubmit(normalize(value), photoFile))}>
      <div className="form-grid">
        <label><span className="field-label">{t('firstName')} <span className="required-indicator" aria-hidden="true">*</span></span><input aria-required="true" autoFocus={autoFocusFirstField} {...register('firstName', { required: t('firstNameRequired') })} />{errors.firstName && <em>{errors.firstName.message}</em>}</label>
        <label>{t('lastName')}<input {...register('lastName')} /></label>
        <label>{t('gender')}<select {...register('gender')}><option value="">{t('chooseGender')}</option><option value="MALE">{t('male')}</option><option value="FEMALE">{t('female')}</option></select></label>
        <span />
        <div className="date-form-field"><label htmlFor="person-birth-date">{t('birthDate')}</label><Controller name="birthDate" control={control} render={({ field }) => <DatePicker id="person-birth-date" label={t('birthDate')} value={field.value} initialViewDate={birthDatePickerAnchor} onChange={field.onChange} />} /></div>
        <label>{t('birthPlace')}<input {...register('birthPlace')} /></label>
        <button
          type="button"
          className="additional-details-toggle full"
          aria-expanded={additionalDetailsOpen}
          onClick={() => setAdditionalDetailsOpen((current) => !current)}
        >
          <span>{additionalDetailsOpen ? t('hideAdditionalDetails') : t('showAdditionalDetails')}</span>
          <span className="additional-details-chevron" aria-hidden="true" />
        </button>
        {additionalDetailsOpen && <div className="additional-details-fields full">
          <label>{t('middleName')}<input {...register('middleName')} /></label>
          <label>{t('maidenName')}<input {...register('maidenName')} /></label>
          <div className="date-form-field"><label htmlFor="person-death-date">{t('deathDate')}</label><Controller name="deathDate" control={control} render={({ field }) => <DatePicker id="person-death-date" label={t('deathDate')} value={field.value} onChange={field.onChange} />} /></div>
          <label>{t('deathPlace')}<input {...register('deathPlace')} /></label>
        </div>}
        <label className="full photo-upload">{t('photo')}
          {person?.photoUrl && <img src={resolvePhotoUrl(person.photoUrl)} alt={t('currentPhoto')} />}
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setPhotoFile(event.target.files?.[0])} />
          <small>{t('photoHelp')}</small>
        </label>
        <label className="full">{t('notes')}<textarea rows={4} {...register('notes')} /></label>
        <small className="required-fields-note full"><span aria-hidden="true">*</span> {t('requiredField')}</small>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer>
        {onCancel && <button type="button" className="quiet" onClick={onCancel}>{t('cancel')}</button>}
        <button className="primary" disabled={busy}>{busy ? t('saving') : submitLabel ?? t('savePerson')}</button>
      </footer>
    </form>
  )
}
