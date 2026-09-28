import React from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import CommentMenu from './components/CommentMenu';
import Stepper from './components/Stepper';
import Home from './screens/Home';
import CommandCenter from './screens/CommandCenter';
import Placeholder from './screens/Placeholder';
import EngagementSetup from './screens/EngagementSetup';
import LegalEntityMaster from './screens/LegalEntityMaster';
import FinancialDataLayer from './screens/FinancialDataLayer';
import CurrencyTranslation from './screens/CurrencyTranslation';
import Intercompany from './screens/Intercompany';
import ConsolidationCycle from './screens/ConsolidationCycle';
import ReportingHub from './screens/ReportingHub';
import ReportingAnalytics from './screens/ReportingAnalytics';
import Workspace from './screens/Workspace';
import ManageTeams from './screens/ManageTeams';
import { useApp } from './state/AppContext';
import { RouteKey } from './routes';

const SCREENS: Partial<Record<RouteKey, React.ComponentType>> = {
  home: Home,
  workspace: Workspace,
  access: ManageTeams,
  command: CommandCenter,
  engagement: EngagementSetup,
  entities: LegalEntityMaster,
  // The design keeps TB, JE and FSLI as tabs inside the Financial Data Layer
  // screen, so the split-out route keys resolve to the same component.
  upload: FinancialDataLayer,
  tb: FinancialDataLayer,
  fslimap: FinancialDataLayer,
  fx: CurrencyTranslation,
  ice: Intercompany,
  consol: ConsolidationCycle,
  reporting: ReportingHub,
  repanalytics: ReportingAnalytics,
};

export default function App() {
  const { route, dark } = useApp();
  const Screen = SCREENS[route] ?? Placeholder;

  return (
    <div className={`${dark ? 'fc-dark' : ''} min-h-screen flex bg-surface-bg text-ink-800`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <Stepper />
        {/*
          flex column so a screen that asks for `flex:1` actually fills the
          viewport (the grid screens size their scroll area from it); still
          scrolls for screens that size to their content.
        */}
        <main className="flex-1 min-h-0 flex flex-col fc-grid-overlay overflow-y-auto">
          <Screen />
        </main>
      </div>
      {/*
        Mounted once for the whole application: right-clicking any text, cell or
        figure offers Add comment / Copy text / Open comments rail.
      */}
      <CommentMenu />
    </div>
  );
}
