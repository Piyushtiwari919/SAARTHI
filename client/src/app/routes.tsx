import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.tsx';
import { LandingPage } from '../pages/Landing/LandingPage.tsx';
import { LoginPage } from '../pages/Login/LoginPage.tsx';
import { SignupPage } from '../pages/Signup/SignupPage.tsx';
import { DashboardPage } from '../pages/Dashboard/DashboardPage.tsx';
import { DocumentsPage } from '../pages/Documents/DocumentsPage.tsx';
import { DocumentDetailsPage } from '../pages/DocumentDetails/DocumentDetailsPage.tsx';
import { OpportunitiesPage } from '../pages/Opportunities/OpportunitiesPage.tsx';
import { EligibilityPage } from '../pages/Eligibility/EligibilityPage.tsx';
import { AssistantPage } from '../pages/Assistant/AssistantPage.tsx';
import { SettingsPage } from '../pages/Settings/SettingsPage.tsx';

export const routes: RouteObject[] = [
  // Public routes
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },

  // Authenticated App Shell routes
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
      },
      {
        path: 'documents/:id',
        element: <DocumentDetailsPage />,
      },
      {
        path: 'opportunities',
        element: <OpportunitiesPage />,
      },
      {
        path: 'eligibility',
        element: <EligibilityPage />,
      },
      {
        path: 'assistant',
        element: <AssistantPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },

  // Fallback
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];
