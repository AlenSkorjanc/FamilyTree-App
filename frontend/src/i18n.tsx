import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const en = {
  appName: 'Family Tree', loadingTrees: 'Loading your family trees…', apiUnavailable: 'Could not reach the family-tree API.',
  startStory: 'Start your family story', startStoryHelp: 'Create a tree, then add people and connect their relationships.',
  treeNamePlaceholder: 'Tree name, e.g. The Novak Family', createTree: 'Create family tree', newTree: '+ New tree', rename: 'Rename',
  newTreePrompt: 'New family tree name', renameTreePrompt: 'Rename family tree', searchPeople: 'Search people…', birthYearUnknown: 'Birth year unknown',
  noPeopleFound: 'No people found', addPerson: '+ Add person', arrangingTree: 'Arranging the family tree…', loadTreeError: 'Could not load this tree.',
  treeReady: 'Your tree is ready', treeReadyHelp: 'Add the first person to begin connecting your family.', addFirstPerson: '+ Add first person',
  unexpectedError: 'Something went wrong', deleteConfirm: 'Delete {name}? Their relationships will also be removed.',
  editPerson: 'Edit person', personDetails: 'Person details', closeDetails: 'Close details', born: 'Born', died: 'Died', unknown: 'Unknown', notes: 'Notes',
  parents: 'Parents', partners: 'Partners', children: 'Children', add: '+ Add', deletePerson: 'Delete person',
  removeRelationship: 'Remove relationship with {name}', nee: 'née',
  parent: 'parent', child: 'child', partner: 'partner', addRelative: 'Add {kind}', createNewPerson: 'Create new person', linkExistingPerson: 'Link existing person',
  relationshipType: 'Relationship type', biological: 'Biological', adoptive: 'Adoptive', step: 'Step', other: 'Other', partnership: 'Partnership', marriage: 'Marriage', married: 'married',
  createAndAdd: 'Create and add {kind}', searchPeopleLabel: 'Search people', typeName: 'Type a name…', noCandidates: 'No matching people available.', linking: 'Linking…', linkPerson: 'Link person',
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name', maidenName: 'Maiden name', gender: 'Gender', optional: 'Optional', chooseGender: 'Select gender', male: 'Male', female: 'Female',
  birthDate: 'Birth date', deathDate: 'Death date', birthPlace: 'Birth place', deathPlace: 'Death place', photoUrl: 'Photo URL',
  firstNameRequired: 'First name is required', savePerson: 'Save person', saving: 'Saving…', close: 'Close', language: 'Language', english: 'English', slovenian: 'Slovenščina', photo: 'Profile photo', photoHelp: 'JPEG, PNG, WebP or GIF, up to 5 MB', currentPhoto: 'Current profile photo',
  quickParent: '+ Parent', quickPartner: '+ Partner', quickChild: '+ Child', quickAddRelative: 'Add {kind} directly to the tree',
  secondParent: 'Other parent (optional)', noSecondParent: 'No other parent', secondParentHelp: 'The child will be connected to both selected parents.',
  samePerson: 'Same person',
  shareChildren: 'Partner is also a parent of the same children', shareChildrenHelp: 'Automatically connect this partner to the existing children ({count}).',
  connectSelected: 'Connect selected people', connectPeople: 'Connect people', connection: 'Connection',
  partnersConnection: '{first} and {second} are partners', firstParentConnection: '{first} is a parent of {second}', secondParentConnection: '{second} is a parent of {first}',
  childrenSource: 'Copy children from', connectPeopleAction: 'Create connection', selectTwoPeopleHelp: 'Ctrl/Cmd-click or Shift-click two people to connect them.',
} as const

type TranslationKey = keyof typeof en
type Translations = Record<TranslationKey, string>

const sl: Translations = {
  appName: 'Družinsko drevo', loadingTrees: 'Nalaganje družinskih dreves…', apiUnavailable: 'Povezava z API-jem družinskega drevesa ni uspela.',
  startStory: 'Začnite svojo družinsko zgodbo', startStoryHelp: 'Ustvarite drevo, nato dodajte osebe in povežite njihove odnose.',
  treeNamePlaceholder: 'Ime drevesa, npr. Družina Novak', createTree: 'Ustvari družinsko drevo', newTree: '+ Novo drevo', rename: 'Preimenuj',
  newTreePrompt: 'Ime novega družinskega drevesa', renameTreePrompt: 'Preimenuj družinsko drevo', searchPeople: 'Išči osebe…', birthYearUnknown: 'Leto rojstva ni znano',
  noPeopleFound: 'Ni najdenih oseb', addPerson: '+ Dodaj osebo', arrangingTree: 'Razporejanje družinskega drevesa…', loadTreeError: 'Drevesa ni bilo mogoče naložiti.',
  treeReady: 'Vaše drevo je pripravljeno', treeReadyHelp: 'Dodajte prvo osebo in začnite povezovati družino.', addFirstPerson: '+ Dodaj prvo osebo',
  unexpectedError: 'Prišlo je do napake', deleteConfirm: 'Želite izbrisati osebo {name}? Odstranjeni bodo tudi vsi njeni odnosi.',
  editPerson: 'Uredi osebo', personDetails: 'Podrobnosti osebe', closeDetails: 'Zapri podrobnosti', born: 'Rojen/a', died: 'Umrl/a', unknown: 'Neznano', notes: 'Opombe',
  parents: 'Starši', partners: 'Partnerji', children: 'Otroci', add: '+ Dodaj', deletePerson: 'Izbriši osebo',
  removeRelationship: 'Odstrani odnos z osebo {name}', nee: 'roj.',
  parent: 'starša', child: 'otroka', partner: 'partnerja', addRelative: 'Dodaj {kind}', createNewPerson: 'Ustvari novo osebo', linkExistingPerson: 'Poveži obstoječo osebo',
  relationshipType: 'Vrsta odnosa', biological: 'Biološki', adoptive: 'Posvojitveni', step: 'Krušni', other: 'Drugo', partnership: 'Partnerstvo', marriage: 'Zakonska zveza', married: 'poročena',
  createAndAdd: 'Ustvari in dodaj {kind}', searchPeopleLabel: 'Išči osebe', typeName: 'Vnesite ime…', noCandidates: 'Ni ustreznih oseb.', linking: 'Povezovanje…', linkPerson: 'Poveži osebo',
  firstName: 'Ime', middleName: 'Drugo ime', lastName: 'Priimek', maidenName: 'Dekliški priimek', gender: 'Spol', optional: 'Neobvezno', chooseGender: 'Izberite spol', male: 'Moški', female: 'Ženski',
  birthDate: 'Datum rojstva', deathDate: 'Datum smrti', birthPlace: 'Kraj rojstva', deathPlace: 'Kraj smrti', photoUrl: 'URL fotografije',
  firstNameRequired: 'Ime je obvezno', savePerson: 'Shrani osebo', saving: 'Shranjevanje…', close: 'Zapri', language: 'Jezik', english: 'English', slovenian: 'Slovenščina', photo: 'Profilna fotografija', photoHelp: 'JPEG, PNG, WebP ali GIF, največ 5 MB', currentPhoto: 'Trenutna profilna fotografija',
  quickParent: '+ Starš', quickPartner: '+ Partner', quickChild: '+ Otrok', quickAddRelative: 'Dodaj {kind} neposredno na drevo',
  secondParent: 'Drugi starš (neobvezno)', noSecondParent: 'Brez drugega starša', secondParentHelp: 'Otrok bo povezan z obema izbranima staršema.',
  samePerson: 'Ista oseba',
  shareChildren: 'Partner je tudi starš istih otrok', shareChildrenHelp: 'Partner bo samodejno povezan kot starš z obstoječimi otroki ({count}).',
  connectSelected: 'Poveži izbrani osebi', connectPeople: 'Poveži osebi', connection: 'Povezava',
  partnersConnection: '{first} in {second} sta partnerja', firstParentConnection: '{first} je starš osebe {second}', secondParentConnection: '{second} je starš osebe {first}',
  childrenSource: 'Kopiraj otroke od', connectPeopleAction: 'Ustvari povezavo', selectTwoPeopleHelp: 'S Ctrl/Cmd ali Shift klikom izberite dve osebi in ju povežite.',
}

export type Language = 'en' | 'sl'
type Translate = (key: TranslationKey, values?: Record<string, string>) => string

interface I18nValue { language: Language; setLanguage: (language: Language) => void; t: Translate }

const defaultValue: I18nValue = { language: 'en', setLanguage: () => undefined, t: (key, values) => interpolate(en[key], values) }
const I18nContext = createContext<I18nValue>(defaultValue)

function interpolate(value: string, values?: Record<string, string>) {
  return Object.entries(values ?? {}).reduce((result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement), value)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('family-tree-language') === 'sl' ? 'sl' : 'en')
  useEffect(() => {
    localStorage.setItem('family-tree-language', language)
    document.documentElement.lang = language
  }, [language])
  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => interpolate((language === 'sl' ? sl : en)[key], values),
  }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }

export function relationshipLabel(value: string, t: Translate) {
  const keys: Record<string, TranslationKey> = {
    BIOLOGICAL: 'biological', ADOPTIVE: 'adoptive', STEP: 'step', OTHER: 'other',
    PARTNERSHIP: 'partnership', MARRIAGE: 'marriage',
  }
  return t(keys[value] ?? 'other')
}
