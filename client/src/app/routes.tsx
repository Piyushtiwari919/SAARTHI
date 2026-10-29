import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.tsx';
import { RouteErrorBoundary } from '../components/ui/RouteErrorBoundary.tsx';
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
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
    errorElement: <RouteErrorBoundary />,
  },

  // Direct friendly shortcuts (e.g., navigating directly to /documents or /dashboard)
  {
    path: '/dashboard',
    element: <Navigate to="/app/dashboard" replace />,
  },
  {
    path: '/documents',
    element: <Navigate to="/app/documents" replace />,
  },
  {
    path: '/opportunities',
    element: <Navigate to="/app/opportunities" replace />,
  },
  {
    path: '/eligibility',
    element: <Navigate to="/app/eligibility" replace />,
  },
  {
    path: '/assistant',
    element: <Navigate to="/app/assistant" replace />,
  },
  {
    path: '/settings',
    element: <Navigate to="/app/settings" replace />,
  },

  // Authenticated App Shell routes
  {
    path: '/app',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/app/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'documents/:id',
        element: <DocumentDetailsPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'opportunities',
        element: <OpportunitiesPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'eligibility',
        element: <EligibilityPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'assistant',
        element: <AssistantPage />,
        errorElement: <RouteErrorBoundary />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },

  // Fallback
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];
