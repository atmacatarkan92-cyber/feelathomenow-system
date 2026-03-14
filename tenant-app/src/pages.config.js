/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Admin from './pages/Admin';
import Announcements from './pages/Announcements';
import Contacts from './pages/Contacts';
import DamageReports from './pages/DamageReports';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Emergency from './pages/Emergency';
import HandoverProtocols from './pages/HandoverProtocols';
import Invoices from './pages/Invoices';
import MyAccommodation from './pages/MyAccommodation';
import Profile from './pages/Profile';
import Services from './pages/Services';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Announcements": Announcements,
    "Contacts": Contacts,
    "DamageReports": DamageReports,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "Emergency": Emergency,
    "HandoverProtocols": HandoverProtocols,
    "Invoices": Invoices,
    "MyAccommodation": MyAccommodation,
    "Profile": Profile,
    "Services": Services,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};