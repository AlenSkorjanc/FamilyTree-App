import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const en = {
  appName: 'Family Tree', loadingTrees: 'Loading your family trees…', apiUnavailable: 'Could not reach the family-tree API.',
  startStory: 'Start your family story', startStoryHelp: 'Create a tree, then add people and connect their relationships.',
  treeNamePlaceholder: 'Tree name, e.g. The Novak Family', createTree: 'Create family tree', newTree: '+ New tree', rename: 'Rename',
  newTreePrompt: 'New family tree name', renameTree: 'Rename family tree', treeName: 'Tree name', saveTreeName: 'Save name', cancel: 'Cancel', searchPeople: 'Search people…', birthYearUnknown: 'Birth year unknown',
  noPeopleFound: 'No people found', addPerson: '+ Add person', menu: 'Menu', openMenu: 'Open menu', closeMenu: 'Close menu', arrangingTree: 'Arranging the family tree…', loadTreeError: 'Could not load this tree.',
  treeReady: 'Your tree is ready', treeReadyHelp: 'Add the first person to begin connecting your family.', addFirstPerson: '+ Add first person',
  unexpectedError: 'Something went wrong', deleteConfirm: 'Delete {name}? Their relationships will also be removed.',
  editPerson: 'Edit person', personDetails: 'Person details', closeDetails: 'Close details', expandDetails: 'Expand details', collapseDetails: 'Collapse details', born: 'Born', bornMale: 'Born', bornFemale: 'Born', died: 'Died', unknown: 'Unknown', notes: 'Notes',
  parents: 'Parents', partners: 'Partners', children: 'Children', add: '+ Add', deletePerson: 'Delete person', parentLimitReached: 'already has two parents',
  removeRelationship: 'Remove relationship with {name}', nee: 'née',
  parent: 'parent', child: 'child', partner: 'partner', addRelative: 'Add {kind}', createNewPerson: 'Create new person', linkExistingPerson: 'Link existing person',
  relationshipType: 'Relationship type', biological: 'Biological', adoptive: 'Adoptive', step: 'Step', other: 'Other', partnership: 'Partnership', marriage: 'Marriage', married: 'Married', couplePartners: 'Partners',
  createAndAdd: 'Create and add {kind}', searchPeopleLabel: 'Search people', typeName: 'Type a name…', noCandidates: 'No matching people available.', linking: 'Linking…', linkPerson: 'Link person',
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name', maidenName: 'Maiden name', gender: 'Gender', optional: 'Optional', chooseGender: 'Select gender', male: 'Male', female: 'Female',
  birthDate: 'Birth date', deathDate: 'Death date', birthPlace: 'Birth place', deathPlace: 'Death place', photoUrl: 'Photo URL',
  chooseDate: 'Choose date', previousMonth: 'Previous month', nextMonth: 'Next month', clearDate: 'Clear date', calendarYear: 'Year', calendarMonth: 'Month', chooseYear: 'Choose year', chooseMonth: 'Choose month', calendarPrevious: 'Previous', calendarNext: 'Next',
  firstNameRequired: 'First name is required', requiredField: 'Required field', showAdditionalDetails: 'Show additional details', hideAdditionalDetails: 'Hide additional details', savePerson: 'Save person', saving: 'Saving…', close: 'Close', language: 'Language', english: 'English', slovenian: 'Slovenščina', photo: 'Profile photo', photoHelp: 'JPEG, PNG, WebP or GIF, up to 5 MB', currentPhoto: 'Current profile photo',
  quickParent: '+ Parent', quickPartner: '+ Partner', quickChild: '+ Child', quickAddRelative: 'Add {kind} directly to the tree',
  secondParent: 'Other parent (optional)', noSecondParent: 'No other parent', secondParentHelp: 'The child will be connected to both selected parents.',
  samePerson: 'Copy',
  currentPartner: 'Current partner', currentPartnerShort: 'current', noCurrentPartner: 'No current partner', setAsCurrentPartner: 'Set as current partner',
  shareChildren: 'Partner is also a parent of the same children', shareChildrenHelp: 'Automatically connect this partner to the existing children ({count}).',
  connectSelected: 'Connect selected people', connectPeople: 'Connect people', connection: 'Connection',
  editRelationship: 'Edit relationship', saveRelationship: 'Save relationship',
  partnersConnection: '{first} and {second} are partners', firstParentConnection: '{first} is a parent of {second}', secondParentConnection: '{second} is a parent of {first}',
  childrenSource: 'Copy children from', connectPeopleAction: 'Create connection', selectTwoPeopleHelp: 'Ctrl/Cmd-click or Shift-click two people to connect them.',
  email: 'Email', password: 'Password', repeatPassword: 'Repeat password', signIn: 'Sign in', signingIn: 'Signing in…', signInHelp: 'Sign in to continue to your family trees.', signInFailed: 'Sign in failed.',
  signUp: 'Sign up', createAccount: 'Create account', creatingAccount: 'Creating account…', registerHelp: 'Create an account to start building your family history.', registrationFailed: 'Account creation failed.',
  noAccount: "Don't have an account?", haveAccount: 'Already have an account?', passwordsMismatch: 'Passwords do not match.', or: 'or', continueGoogle: 'Continue with Google', continueFacebook: 'Continue with Facebook',
  oauthFailed: 'Social sign-in could not be completed.', accountLinkRequired: 'An account with this email already exists. Sign in with that account before linking a social provider.', completingSignIn: 'Completing sign in…', backToLogin: 'Back to sign in',
  restoringSession: 'Restoring your session…', redirectingToLogin: 'Redirecting to sign in…', signOut: 'Sign out',
  shareTree: 'Share tree', shareTreeHelp: 'Choose who can view this family tree. Only the owner can make changes.', privateTree: 'Private', privateTreeHelp: 'Only you can open and edit this tree.', restrictedTree: 'Selected users', restrictedTreeHelp: 'Only the listed signed-in users can view the tree.', publicTree: 'Public link', publicTreeHelp: 'Anyone with the public link can view the tree.', allowedUsers: 'Allowed users', allowedUsersPlaceholder: 'person@example.com, one address per line', allowedUsersHelp: 'Each email must already belong to a Family Tree account.', publicLink: 'Public URL', copyLink: 'Copy link', saveSharing: 'Save access', readOnly: 'View only', publicTreeUnavailable: 'This public tree link is unavailable.', sharedTreeEmpty: 'This shared tree does not contain any people yet.',
  claimGuestTrees: 'Connect trees from this device', claimGuestTreesHelp: 'These trees are stored securely on the server, while this device remembers their IDs. Select the trees you want to connect to your profile.', connectToProfile: 'Connect to profile', notNow: 'Not now',
} as const

type TranslationKey = keyof typeof en
type Translations = Record<TranslationKey, string>

const sl: Translations = {
  appName: 'Družinsko drevo', loadingTrees: 'Nalaganje družinskih dreves…', apiUnavailable: 'Povezava z API-jem družinskega drevesa ni uspela.',
  startStory: 'Začnite svojo družinsko zgodbo', startStoryHelp: 'Ustvarite drevo, nato dodajte osebe in povežite njihove odnose.',
  treeNamePlaceholder: 'Ime drevesa, npr. Družina Novak', createTree: 'Ustvari družinsko drevo', newTree: '+ Novo drevo', rename: 'Preimenuj',
  newTreePrompt: 'Ime novega družinskega drevesa', renameTree: 'Preimenuj družinsko drevo', treeName: 'Ime drevesa', saveTreeName: 'Shrani ime', cancel: 'Prekliči', searchPeople: 'Išči osebe…', birthYearUnknown: 'Leto rojstva ni znano',
  noPeopleFound: 'Ni najdenih oseb', addPerson: '+ Dodaj osebo', menu: 'Meni', openMenu: 'Odpri meni', closeMenu: 'Zapri meni', arrangingTree: 'Razporejanje družinskega drevesa…', loadTreeError: 'Drevesa ni bilo mogoče naložiti.',
  treeReady: 'Vaše drevo je pripravljeno', treeReadyHelp: 'Dodajte prvo osebo in začnite povezovati družino.', addFirstPerson: '+ Dodaj prvo osebo',
  unexpectedError: 'Prišlo je do napake', deleteConfirm: 'Želite izbrisati osebo {name}? Odstranjeni bodo tudi vsi njeni odnosi.',
  editPerson: 'Uredi osebo', personDetails: 'Podrobnosti osebe', closeDetails: 'Zapri podrobnosti', expandDetails: 'Povečaj podrobnosti', collapseDetails: 'Zmanjšaj podrobnosti', born: 'Rojen/a', bornMale: 'Rojen', bornFemale: 'Rojena', died: 'Umrl/a', unknown: 'Neznano', notes: 'Opombe',
  parents: 'Starši', partners: 'Partnerji', children: 'Otroci', add: '+ Dodaj', deletePerson: 'Izbriši osebo', parentLimitReached: 'že ima dva starša',
  removeRelationship: 'Odstrani odnos z osebo {name}', nee: 'roj.',
  parent: 'starša', child: 'otroka', partner: 'partnerja', addRelative: 'Dodaj {kind}', createNewPerson: 'Ustvari novo osebo', linkExistingPerson: 'Poveži obstoječo osebo',
  relationshipType: 'Vrsta odnosa', biological: 'Biološki', adoptive: 'Posvojitveni', step: 'Krušni', other: 'Drugo', partnership: 'Partnerstvo', marriage: 'Zakonska zveza', married: 'Poročena', couplePartners: 'Partnerja',
  createAndAdd: 'Ustvari in dodaj {kind}', searchPeopleLabel: 'Išči osebe', typeName: 'Vnesite ime…', noCandidates: 'Ni ustreznih oseb.', linking: 'Povezovanje…', linkPerson: 'Poveži osebo',
  firstName: 'Ime', middleName: 'Drugo ime', lastName: 'Priimek', maidenName: 'Dekliški priimek', gender: 'Spol', optional: 'Neobvezno', chooseGender: 'Izberite spol', male: 'Moški', female: 'Ženski',
  birthDate: 'Datum rojstva', deathDate: 'Datum smrti', birthPlace: 'Kraj rojstva', deathPlace: 'Kraj smrti', photoUrl: 'URL fotografije',
  chooseDate: 'Izberite datum', previousMonth: 'Prejšnji mesec', nextMonth: 'Naslednji mesec', clearDate: 'Počisti datum', calendarYear: 'Leto', calendarMonth: 'Mesec', chooseYear: 'Izberite leto', chooseMonth: 'Izberite mesec', calendarPrevious: 'Prejšnje', calendarNext: 'Naslednje',
  firstNameRequired: 'Ime je obvezno', requiredField: 'Obvezno polje', showAdditionalDetails: 'Prikaži dodatne podatke', hideAdditionalDetails: 'Skrij dodatne podatke', savePerson: 'Shrani osebo', saving: 'Shranjevanje…', close: 'Zapri', language: 'Jezik', english: 'English', slovenian: 'Slovenščina', photo: 'Profilna fotografija', photoHelp: 'JPEG, PNG, WebP ali GIF, največ 5 MB', currentPhoto: 'Trenutna profilna fotografija',
  quickParent: '+ Starš', quickPartner: '+ Partner', quickChild: '+ Otrok', quickAddRelative: 'Dodaj {kind} neposredno na drevo',
  secondParent: 'Drugi starš (neobvezno)', noSecondParent: 'Brez drugega starša', secondParentHelp: 'Otrok bo povezan z obema izbranima staršema.',
  samePerson: 'Kopija',
  currentPartner: 'Trenutni partner', currentPartnerShort: 'trenutni', noCurrentPartner: 'Brez trenutnega partnerja', setAsCurrentPartner: 'Nastavi kot trenutnega partnerja',
  shareChildren: 'Partner je tudi starš istih otrok', shareChildrenHelp: 'Partner bo samodejno povezan kot starš z obstoječimi otroki ({count}).',
  connectSelected: 'Poveži izbrani osebi', connectPeople: 'Poveži osebi', connection: 'Povezava',
  editRelationship: 'Uredi odnos', saveRelationship: 'Shrani odnos',
  partnersConnection: '{first} in {second} sta partnerja', firstParentConnection: '{first} je starš osebe {second}', secondParentConnection: '{second} je starš osebe {first}',
  childrenSource: 'Kopiraj otroke od', connectPeopleAction: 'Ustvari povezavo', selectTwoPeopleHelp: 'S Ctrl/Cmd ali Shift klikom izberite dve osebi in ju povežite.',
  email: 'E-pošta', password: 'Geslo', repeatPassword: 'Ponovite geslo', signIn: 'Prijava', signingIn: 'Prijavljanje…', signInHelp: 'Prijavite se za dostop do svojih družinskih dreves.', signInFailed: 'Prijava ni uspela.',
  signUp: 'Registracija', createAccount: 'Ustvari račun', creatingAccount: 'Ustvarjanje računa…', registerHelp: 'Ustvarite račun in začnite graditi svojo družinsko zgodovino.', registrationFailed: 'Računa ni bilo mogoče ustvariti.',
  noAccount: 'Še nimate računa?', haveAccount: 'Že imate račun?', passwordsMismatch: 'Gesli se ne ujemata.', or: 'ali', continueGoogle: 'Nadaljuj z Googlom', continueFacebook: 'Nadaljuj s Facebookom',
  oauthFailed: 'Prijave prek zunanjega ponudnika ni bilo mogoče dokončati.', accountLinkRequired: 'Račun s tem e-poštnim naslovom že obstaja. Najprej se prijavite vanj in nato varno povežite ponudnika.', completingSignIn: 'Dokončevanje prijave…', backToLogin: 'Nazaj na prijavo',
  restoringSession: 'Obnavljanje seje…', redirectingToLogin: 'Preusmerjanje na prijavo…', signOut: 'Odjava',
  shareTree: 'Deli drevo', shareTreeHelp: 'Izberite, kdo lahko vidi to družinsko drevo. Spremembe lahko dela samo lastnik.', privateTree: 'Zasebno', privateTreeHelp: 'Drevo lahko odprete in urejate samo vi.', restrictedTree: 'Izbrani uporabniki', restrictedTreeHelp: 'Drevo lahko vidijo samo navedeni prijavljeni uporabniki.', publicTree: 'Javna povezava', publicTreeHelp: 'Drevo lahko vidi vsak, ki ima javno povezavo.', allowedUsers: 'Uporabniki z dostopom', allowedUsersPlaceholder: 'oseba@example.com, en naslov na vrstico', allowedUsersHelp: 'Vsak e-poštni naslov mora že pripadati računu Družinsko drevo.', publicLink: 'Javni URL', copyLink: 'Kopiraj povezavo', saveSharing: 'Shrani dostop', readOnly: 'Samo ogled', publicTreeUnavailable: 'Ta javna povezava do drevesa ni na voljo.', sharedTreeEmpty: 'To deljeno drevo še nima dodanih oseb.',
  claimGuestTrees: 'Poveži drevesa s te naprave', claimGuestTreesHelp: 'Drevesa so varno shranjena na strežniku, naprava pa si zapomni njihove ID-je. Izberite drevesa, ki jih želite povezati s profilom.', connectToProfile: 'Poveži s profilom', notNow: 'Ne zdaj',
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

export function partnershipStatusLabel(value: string, t: Translate) {
  if (value === 'MARRIAGE') return t('married')
  if (value === 'PARTNERSHIP') return t('couplePartners')
  return t('other')
}
