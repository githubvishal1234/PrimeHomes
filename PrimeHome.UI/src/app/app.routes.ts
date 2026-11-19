import { Routes } from '@angular/router';

import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';


export const routes: Routes = [

  // =========================
  // HOME
  // =========================

  {
    path: '',
    loadComponent: () => import('./home/home').then(m => m.Home)
  },


  // =========================
  // LOGIN
  // =========================

  {
    path: 'login',
    loadComponent: () => import('./login/login').then(m => m.Login)
  },


  // =========================
  // REGISTER
  // =========================

  {
    path: 'register',
    loadComponent: () => import('./register/register').then(m => m.Register)
  },
  {
  path: 'notifications',
  loadComponent: () => import('./notifications/notifications').then(m => m.Notifications),
  canActivate: [authGuard]
},
{
  path: 'contact-request',
  loadComponent: () => import('./contact-request/contact-request').then(m => m.ContactRequest)
},


  // =========================
  // PROPERTY LIST: public, like any listings portal
  // =========================

  {
    path: 'properties',
    loadComponent: () => import('./property-list/property-list').then(m => m.PropertyList)
  },


  // =========================
  // PROPERTY COMPARISON
  // BUYER ONLY
  // =========================

  {
    path: 'compare-properties',
    loadComponent: () => import('./compare-properties/compare-properties').then(m => m.CompareProperties),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Buyer']
    }
  },


  // =========================
  // PROPERTY DETAILS: public; actions ask guests to sign in
  // =========================

  {
    path: 'properties/:id',
    loadComponent: () => import('./property-details/property-details').then(m => m.PropertyDetails)
  },
  {
    // Same page with a readable slug, e.g. /properties/3/spacious-3-bhk-...-hyderabad
    path: 'properties/:id/:slug',
    loadComponent: () => import('./property-details/property-details').then(m => m.PropertyDetails)
  },


  // =========================
  // ACCOUNT HELP (links from emails)
  // =========================

  { path: 'forgot-password', loadComponent: () => import('./account/account-page').then(m => m.AccountPage), data: { mode: 'forgot' } },
  { path: 'reset-password', loadComponent: () => import('./account/account-page').then(m => m.AccountPage), data: { mode: 'reset' } },
  { path: 'verify-email', loadComponent: () => import('./account/account-page').then(m => m.AccountPage), data: { mode: 'verify' } },


  // =========================
  // SITE VISITS: buyer bookings / owner requests
  // =========================

  {
    path: 'site-visits',
    loadComponent: () => import('./site-visits/site-visits').then(m => m.SiteVisits),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Buyer', 'Owner']
    }
  },


  // =========================
  // BUYER DASHBOARD
  // BUYER ONLY
  // =========================

  {
    path: 'buyer-dashboard',
    loadComponent: () => import('./buyer-dashboard/buyer-dashboard').then(m => m.BuyerDashboard),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Buyer']
    }
  },


  // =========================
  // BUYER - MY FAVORITES
  // BUYER ONLY
  // =========================

  {
    path: 'my-favorites',
    loadComponent: () => import('./my-favorites/my-favorites').then(m => m.MyFavorites),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Buyer']
    }
  },


  // =========================
  // USER PROFILE
  // BUYER / OWNER
  // =========================

  {
    path: 'profile',
    loadComponent: () => import('./user-profile/user-profile').then(m => m.UserProfile),
    canActivate: [authGuard]
  },


  // =========================
  // BUYER - MY INQUIRIES
  // BUYER ONLY
  // =========================

  {
    path: 'my-inquiries',
    loadComponent: () => import('./my-inquiries/my-inquiries').then(m => m.MyInquiries),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Buyer']
    }
  },


  // =========================
  // OWNER DASHBOARD
  // OWNER ONLY
  // =========================

  {
    path: 'owner-dashboard',
    loadComponent: () => import('./owner-dashboard/owner-dashboard').then(m => m.OwnerDashboard),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Owner']
    }
  },


  // =========================
  // OWNER - MY PROPERTIES
  // OWNER ONLY
  // =========================

  {
    path: 'my-properties',
    loadComponent: () => import('./my-properties/my-properties').then(m => m.MyProperties),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Owner']
    }
  },


  // =========================
  // OWNER - ADD PROPERTY
  // OWNER ONLY
  // =========================

  {
    path: 'add-property',
    loadComponent: () => import('./add-property/add-property').then(m => m.AddProperty),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Owner']
    }
  },


  // =========================
  // OWNER - INQUIRIES
  // OWNER ONLY
  // =========================

  {
    path: 'owner-inquiries',
    loadComponent: () => import('./owner-inquiries/owner-inquiries').then(m => m.OwnerInquiries),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Owner']
    }
  },


  // =========================
  // ADMIN DASHBOARD
  // ADMIN ONLY
  // =========================

  {
    path: 'admin-dashboard',
    loadComponent: () => import('./admin-dashboard/admin-dashboard').then(m => m.AdminDashboard),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['Admin']
    }
  },


  // =========================
  // INVALID URL
  // =========================

  {
    path: '**',
    redirectTo: ''
  }

];