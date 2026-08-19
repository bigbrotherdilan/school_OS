import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enLayout from './en/layout.json';
import enUi from './en/ui.json';
import enAuth from './en/auth.json';
import enAdminAcademic from './en/adminAcademic.json';
import enAdminAcademicMgmt from './en/adminAcademicMgmt.json';
import enAdminStaffOps from './en/adminStaffOps.json';
import enAdminFinance from './en/adminFinance.json';
import enAdminGov from './en/adminGov.json';
import enGov from './en/gov.json';
import enTeacher from './en/teacher.json';
import enParent from './en/parent.json';
import enPublicSite from './en/publicSite.json';

import frLayout from './fr/layout.json';
import frUi from './fr/ui.json';
import frAuth from './fr/auth.json';
import frAdminAcademic from './fr/adminAcademic.json';
import frAdminAcademicMgmt from './fr/adminAcademicMgmt.json';
import frAdminStaffOps from './fr/adminStaffOps.json';
import frAdminFinance from './fr/adminFinance.json';
import frAdminGov from './fr/adminGov.json';
import frGov from './fr/gov.json';
import frTeacher from './fr/teacher.json';
import frParent from './fr/parent.json';
import frPublicSite from './fr/publicSite.json';

const resources = {
  en: {
    layout: enLayout,
    ui: enUi,
    auth: enAuth,
    adminAcademic: enAdminAcademic,
    adminAcademicMgmt: enAdminAcademicMgmt,
    adminStaffOps: enAdminStaffOps,
    adminFinance: enAdminFinance,
    adminGov: enAdminGov,
    gov: enGov,
    teacher: enTeacher,
    parent: enParent,
    publicSite: enPublicSite,
  },
  fr: {
    layout: frLayout,
    ui: frUi,
    auth: frAuth,
    adminAcademic: frAdminAcademic,
    adminAcademicMgmt: frAdminAcademicMgmt,
    adminStaffOps: frAdminStaffOps,
    adminFinance: frAdminFinance,
    adminGov: frAdminGov,
    gov: frGov,
    teacher: frTeacher,
    parent: frParent,
    publicSite: frPublicSite,
  },
};

const stored = localStorage.getItem('schoolos.lang');
const browserLang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: stored || browserLang,
  fallbackLng: 'en',
  defaultNS: 'layout',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('schoolos.lang', lng);
  document.documentElement.lang = lng;
});

export default i18n;