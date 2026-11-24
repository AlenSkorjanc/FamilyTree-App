import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const en = {
  appName: 'Family Tree', home: 'Home', loadingTrees: 'Loading your family trees…', apiUnavailable: 'Could not reach the family-tree API.',
  startStory: 'Start your family story', startStoryHelp: 'Create a tree, then add people and connect their relationships.',
  treeNamePlaceholder: 'Tree name, e.g. The Novak Family', createTree: 'Create family tree', newTree: '+ New tree', rename: 'Rename',
  newTreePrompt: 'New family tree name', renameTree: 'Rename family tree', deleteTree: 'Delete tree', deleteTreeConfirm: 'Delete “{name}”? All people, relationships, and sharing links in this tree will be permanently removed.', deletingTree: 'Deleting…', treeName: 'Tree name', saveTreeName: 'Save name', cancel: 'Cancel', searchPeople: 'Search people…', birthYearUnknown: 'Birth year unknown',
  noPeopleFound: 'No people found', addPerson: '+ Add person', menu: 'Menu', openMenu: 'Open menu', closeMenu: 'Close menu', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fitView: 'Fit tree to view', arrangingTree: 'Arranging the family tree…', loadTreeError: 'Could not load this tree.',
  treeReady: 'Your tree is ready', treeReadyHelp: 'Add the first person to begin connecting your family.', addFirstPerson: '+ Add first person',
  unexpectedError: 'Something went wrong', deleteConfirm: 'Delete {name}? Their relationships will also be removed.',
  editPerson: 'Edit person', personDetails: 'Person details', closeDetails: 'Close details', expandDetails: 'Expand details', collapseDetails: 'Collapse details', born: 'Born', bornMale: 'Born', bornFemale: 'Born', died: 'Died', unknown: 'Unknown', notes: 'Notes',
  parents: 'Parents', partners: 'Partners', children: 'Children', add: '+ Add', deletePerson: 'Delete person',
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
  ancestryCycleShort: 'would create an ancestry cycle', parentLimitShort: 'already has two parents', maxParentsError: 'A child can have at most two parents. Remove a parent link before adding another.', unsupportedParentTypeError: 'Only biological and adoptive parent relationships are supported.', ancestryCycleError: 'This relationship would make the parent a descendant of the child.', selfParentError: 'A person cannot be their own parent or child.', duplicateParentChildError: 'This parent-child relationship already exists.', biologicalParentDatesError: 'A biological parent cannot be born after their child.', selfPartnershipError: 'A person cannot be partnered with themselves.', duplicatePartnershipError: 'This partnership already exists.', invalidPartnershipDatesError: 'The partnership end date cannot be before its start date.', invalidPersonDatesError: 'The death date cannot be before the birth date.',
  email: 'Email', password: 'Password', repeatPassword: 'Repeat password', signIn: 'Sign in', signingIn: 'Signing in…', signInHelp: 'Sign in to continue to your family trees.', signInFailed: 'Sign in failed.',
  signUp: 'Sign up', createAccount: 'Create account', creatingAccount: 'Creating account…', registerHelp: 'Create an account to start building your family history.', registrationFailed: 'Account creation failed.',
  noAccount: "Don't have an account?", haveAccount: 'Already have an account?', passwordsMismatch: 'Passwords do not match.', or: 'or', continueGoogle: 'Continue with Google', continueFacebook: 'Continue with Facebook',
  emailSendFailed: 'The email could not be sent. Please try again.',
  oauthFailed: 'Social sign-in could not be completed.', accountLinkRequired: 'An account with this email already exists. Sign in with that account before linking a social provider.', completingSignIn: 'Completing sign in…', backToLogin: 'Back to sign in', forgotPassword: 'Forgot password?', forgotPasswordHelp: 'Enter your email and we will send you a secure password-reset link.', sendResetEmail: 'Send reset email', resetEmailSent: 'If an account exists for that email, a reset link has been sent.', resetPassword: 'Reset password', resetPasswordHelp: 'Choose a new password with at least 8 characters.', passwordResetFailed: 'The password could not be reset.', passwordChangedLoginHelp: 'Your password has been changed. Sign in with the new password.', checkEmail: 'Check your email', verificationSentHelp: 'We sent a verification link to your email address. Verify it before signing in.', resendEmail: 'Resend email', verificationResent: 'A new verification email has been sent.', verifyEmail: 'Verify email', verifyEmailHelp: 'Confirm your email address to activate your account.', verifying: 'Verifying…', emailVerified: 'Email verified', emailVerifiedHelp: 'Your account is ready to use.', continueToLogin: 'Continue to sign in', invalidVerificationLink: 'This verification link is invalid or has expired.', sending: 'Sending…', sendVerificationEmail: 'Send verification email', passwordEmailSent: 'Check your email to continue changing your password.', changePasswordEmailHelp: 'Confirm your current password, then use the secure link sent to your email.', setPasswordEmailHelp: 'We will email you a secure link for setting a password.',
  restoringSession: 'Restoring your session…', redirectingToLogin: 'Redirecting to sign in…', signOut: 'Sign out', accountMenu: 'Account menu', editProfile: 'Edit profile', editProfileHelp: 'Manage the same personal details used for people in your family trees.', saveProfile: 'Save profile', profileSaved: 'Your profile has been saved.', accountSecurity: 'Account and sessions', accountSecurityHelp: 'Manage your password, active sessions, or permanently remove your account.', changePassword: 'Change password', changePasswordHelp: 'Confirm your current password and choose a new one with at least 8 characters.', setPassword: 'Set password', setPasswordHelp: 'Add password sign-in to this account.', currentPassword: 'Current password', newPassword: 'New password', repeatNewPassword: 'Repeat new password', passwordChanged: 'Your password has been changed.', logoutAllDevices: 'Sign out of all devices', logoutAllConfirm: 'Sign out of every device currently connected to this account?', deleteProfile: 'Delete profile', deleteProfileConfirm: 'Permanently delete your profile? Your owned family trees, people, relationships, and sharing links will also be deleted. This cannot be undone.',
  shareTree: 'Share tree', shareTreeHelp: 'Public-link access and selected-user access can be enabled together. Choose view or edit permission for each.', privateTree: 'Private', privateTreeHelp: 'Only you can open and edit this tree.', restrictedTree: 'Selected users', restrictedTreeHelp: 'Grant access to individual signed-in users.', publicTree: 'Share by URL', publicTreeHelp: 'Anyone with this URL receives the permission selected below.', allowedUsers: 'Selected users', allowedUsersPlaceholder: 'person@example.com', allowedUsersHelp: 'Each email must already belong to a Family Tree account. Permissions are set separately for every user.', publicLink: 'Sharing URL', copyLink: 'Copy link', deletePublicLink: 'Delete sharing URL', publicLinkCreatedAfterSave: 'The sharing URL will be created after you save.', linkPermission: 'URL permission', userPermission: 'User permission', viewPermission: 'Can view', editPermission: 'Can edit', addUser: 'Add user', removeUser: 'Remove user', saveSharing: 'Save access', readOnly: 'View only', publicTreeUnavailable: 'This public tree link is unavailable.', sharedTreeEmpty: 'This shared tree does not contain any people yet.',
  claimGuestTrees: 'Connect trees from this device', claimGuestTreesHelp: 'These trees are stored securely on the server, while this device remembers their IDs. Select the trees you want to connect to your profile.', connectToProfile: 'Connect to profile', notNow: 'Not now',
} as const

type TranslationKey = keyof typeof en
type Translations = Record<TranslationKey, string>

const sl: Translations = {
  appName: 'Družinsko drevo', home: 'Domov', loadingTrees: 'Nalaganje družinskih dreves…', apiUnavailable: 'Povezava z API-jem družinskega drevesa ni uspela.',
  startStory: 'Začnite svojo družinsko zgodbo', startStoryHelp: 'Ustvarite drevo, nato dodajte osebe in povežite njihove odnose.',
  treeNamePlaceholder: 'Ime drevesa, npr. Družina Novak', createTree: 'Ustvari družinsko drevo', newTree: '+ Novo drevo', rename: 'Preimenuj',
  newTreePrompt: 'Ime novega družinskega drevesa', renameTree: 'Preimenuj družinsko drevo', deleteTree: 'Izbriši drevo', deleteTreeConfirm: 'Želite izbrisati drevo »{name}«? Vse osebe, povezave in povezave za deljenje v tem drevesu bodo trajno odstranjene.', deletingTree: 'Brisanje…', treeName: 'Ime drevesa', saveTreeName: 'Shrani ime', cancel: 'Prekliči', searchPeople: 'Išči osebe…', birthYearUnknown: 'Leto rojstva ni znano',
  noPeopleFound: 'Ni najdenih oseb', addPerson: '+ Dodaj osebo', menu: 'Meni', openMenu: 'Odpri meni', closeMenu: 'Zapri meni', zoomIn: 'Povečaj', zoomOut: 'Pomanjšaj', fitView: 'Prilagodi drevo pogledu', arrangingTree: 'Razporejanje družinskega drevesa…', loadTreeError: 'Drevesa ni bilo mogoče naložiti.',
  treeReady: 'Vaše drevo je pripravljeno', treeReadyHelp: 'Dodajte prvo osebo in začnite povezovati družino.', addFirstPerson: '+ Dodaj prvo osebo',
  unexpectedError: 'Prišlo je do napake', deleteConfirm: 'Želite izbrisati osebo {name}? Odstranjeni bodo tudi vsi njeni odnosi.',
  editPerson: 'Uredi osebo', personDetails: 'Podrobnosti osebe', closeDetails: 'Zapri podrobnosti', expandDetails: 'Povečaj podrobnosti', collapseDetails: 'Zmanjšaj podrobnosti', born: 'Rojen/a', bornMale: 'Rojen', bornFemale: 'Rojena', died: 'Umrl/a', unknown: 'Neznano', notes: 'Opombe',
  parents: 'Starši', partners: 'Partnerji', children: 'Otroci', add: '+ Dodaj', deletePerson: 'Izbriši osebo',
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
  ancestryCycleShort: 'ustvarilo bi cikel prednikov', parentLimitShort: 'že ima dva starša', maxParentsError: 'Otrok ima lahko največ dva starša. Pred dodajanjem novega starša odstranite eno od obstoječih povezav.', unsupportedParentTypeError: 'Podprti sta samo biološka in posvojiteljska povezava med staršem in otrokom.', ancestryCycleError: 'Ta povezava bi povzročila, da bi starš postal potomec otroka.', selfParentError: 'Oseba ne more biti sama svoj starš ali otrok.', duplicateParentChildError: 'Ta povezava med staršem in otrokom že obstaja.', biologicalParentDatesError: 'Biološki starš ne more biti rojen po svojem otroku.', selfPartnershipError: 'Oseba ne more biti partner sama s seboj.', duplicatePartnershipError: 'To partnerstvo že obstaja.', invalidPartnershipDatesError: 'Datum konca partnerstva ne more biti pred datumom začetka.', invalidPersonDatesError: 'Datum smrti ne more biti pred datumom rojstva.',
  email: 'E-pošta', password: 'Geslo', repeatPassword: 'Ponovite geslo', signIn: 'Prijava', signingIn: 'Prijavljanje…', signInHelp: 'Prijavite se za dostop do svojih družinskih dreves.', signInFailed: 'Prijava ni uspela.',
  signUp: 'Registracija', createAccount: 'Ustvari račun', creatingAccount: 'Ustvarjanje računa…', registerHelp: 'Ustvarite račun in začnite graditi svojo družinsko zgodovino.', registrationFailed: 'Računa ni bilo mogoče ustvariti.',
  noAccount: 'Še nimate računa?', haveAccount: 'Že imate račun?', passwordsMismatch: 'Gesli se ne ujemata.', or: 'ali', continueGoogle: 'Nadaljuj z Googlom', continueFacebook: 'Nadaljuj s Facebookom',
  emailSendFailed: 'E-pošte ni bilo mogoče poslati. Poskusite znova.',
  oauthFailed: 'Prijave prek zunanjega ponudnika ni bilo mogoče dokončati.', accountLinkRequired: 'Račun s tem e-poštnim naslovom že obstaja. Najprej se prijavite vanj in nato varno povežite ponudnika.', completingSignIn: 'Dokončevanje prijave…', backToLogin: 'Nazaj na prijavo', forgotPassword: 'Ste pozabili geslo?', forgotPasswordHelp: 'Vnesite e-pošto in poslali vam bomo varno povezavo za ponastavitev gesla.', sendResetEmail: 'Pošlji e-pošto za ponastavitev', resetEmailSent: 'Če račun s to e-pošto obstaja, je bila poslana povezava za ponastavitev.', resetPassword: 'Ponastavi geslo', resetPasswordHelp: 'Izberite novo geslo z najmanj 8 znaki.', passwordResetFailed: 'Gesla ni bilo mogoče ponastaviti.', passwordChangedLoginHelp: 'Geslo je bilo spremenjeno. Prijavite se z novim geslom.', checkEmail: 'Preverite e-pošto', verificationSentHelp: 'Na vaš e-poštni naslov smo poslali potrditveno povezavo. Pred prijavo ga potrdite.', resendEmail: 'Ponovno pošlji e-pošto', verificationResent: 'Poslano je bilo novo potrditveno e-poštno sporočilo.', verifyEmail: 'Potrdi e-pošto', verifyEmailHelp: 'Potrdite e-poštni naslov in aktivirajte račun.', verifying: 'Potrjevanje…', emailVerified: 'E-pošta je potrjena', emailVerifiedHelp: 'Vaš račun je pripravljen za uporabo.', continueToLogin: 'Nadaljuj na prijavo', invalidVerificationLink: 'Ta potrditvena povezava ni veljavna ali je potekla.', sending: 'Pošiljanje…', sendVerificationEmail: 'Pošlji potrditveno e-pošto', passwordEmailSent: 'Za nadaljevanje spremembe gesla preverite e-pošto.', changePasswordEmailHelp: 'Potrdite trenutno geslo in nato uporabite varno povezavo, poslano na e-pošto.', setPasswordEmailHelp: 'Po e-pošti vam bomo poslali varno povezavo za nastavitev gesla.',
  restoringSession: 'Obnavljanje seje…', redirectingToLogin: 'Preusmerjanje na prijavo…', signOut: 'Odjava', accountMenu: 'Meni uporabnika', editProfile: 'Uredi profil', editProfileHelp: 'Upravljajte iste osebne podatke, kot jih uporabljajo osebe v družinskih drevesih.', saveProfile: 'Shrani profil', profileSaved: 'Profil je bil shranjen.', accountSecurity: 'Račun in seje', accountSecurityHelp: 'Upravljajte geslo, aktivne seje ali trajno odstranite svoj račun.', changePassword: 'Spremeni geslo', changePasswordHelp: 'Potrdite trenutno geslo in izberite novo z najmanj 8 znaki.', setPassword: 'Nastavi geslo', setPasswordHelp: 'Temu računu dodajte možnost prijave z geslom.', currentPassword: 'Trenutno geslo', newPassword: 'Novo geslo', repeatNewPassword: 'Ponovite novo geslo', passwordChanged: 'Geslo je bilo spremenjeno.', logoutAllDevices: 'Odjava iz vseh naprav', logoutAllConfirm: 'Se želite odjaviti iz vseh naprav, ki so trenutno povezane s tem računom?', deleteProfile: 'Izbriši profil', deleteProfileConfirm: 'Želite trajno izbrisati profil? Izbrisana bodo tudi vsa vaša družinska drevesa, osebe, povezave in povezave za deljenje. Tega ni mogoče razveljaviti.',
  shareTree: 'Deli drevo', shareTreeHelp: 'Dostop prek povezave in dostop izbranih uporabnikov sta lahko omogočena hkrati. Za vsakega izberite ogled ali urejanje.', privateTree: 'Zasebno', privateTreeHelp: 'Drevo lahko odprete in urejate samo vi.', restrictedTree: 'Izbrani uporabniki', restrictedTreeHelp: 'Omogočite dostop posameznim prijavljenim uporabnikom.', publicTree: 'Deli prek URL-ja', publicTreeHelp: 'Vsak s tem URL-jem prejme spodaj izbrano dovoljenje.', allowedUsers: 'Izbrani uporabniki', allowedUsersPlaceholder: 'oseba@example.com', allowedUsersHelp: 'Vsak e-poštni naslov mora že pripadati računu Družinsko drevo. Dovoljenje nastavite posebej za vsakega uporabnika.', publicLink: 'URL za deljenje', copyLink: 'Kopiraj povezavo', deletePublicLink: 'Izbriši URL za deljenje', publicLinkCreatedAfterSave: 'URL za deljenje bo ustvarjen po shranjevanju.', linkPermission: 'Dovoljenje URL-ja', userPermission: 'Dovoljenje uporabnika', viewPermission: 'Lahko gleda', editPermission: 'Lahko ureja', addUser: 'Dodaj uporabnika', removeUser: 'Odstrani uporabnika', saveSharing: 'Shrani dostop', readOnly: 'Samo ogled', publicTreeUnavailable: 'Ta javna povezava do drevesa ni na voljo.', sharedTreeEmpty: 'To deljeno drevo še nima dodanih oseb.',
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
