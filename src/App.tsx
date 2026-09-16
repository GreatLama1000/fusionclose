import React from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Stepper from './components/Stepper';
import Home from './screens/Home';
import CommandCenter from './screens/CommandCenter';
import Placeholder from './screens/Placeholder';
import EngagementSetup from './screens/EngagementSetup';
import LegalEntityMaster from './screens/LegalEntityMaster';
import FinancialDataLayer from './screens/FinancialDataLayer';
import TrialBalance from './screens/TrialBalance';
import FsliMapping from './screens/FsliMapping';
import CurrencyTranslation from './screens/CurrencyTranslation';
import Intercompany from './screens/Intercompany';
import ConsolidationCycle from './screens/ConsolidationCycle';
import ReportingHub from './screens/ReportingHub';
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
  upload: FinancialDataLayer,
  tb: TrialBalance,
  fslimap: FsliMapping,
  fx: CurrencyTranslation,
  ice: Intercompany,
  consol: ConsolidationCycle,
  reporting: ReportingHub,
};

export default function App() {
  const { route, dark } = useApp();
  const Screen = SCREENS[route] ?? Placeholder;

  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen flex bg-surface-bg text-ink-800`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <Stepper />
        <main className="flex-1 fc-grid-overlay overflow-y-auto">
          <Screen />
        </main>
      </div>
    </div>
  );
}
