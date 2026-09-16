export type RouteKey =
  | 'home' | 'workspace' | 'command' | 'intake' | 'engagement' | 'entities' | 'access'
  | 'upload' | 'tb' | 'atb' | 'fslimap' | 'fx' | 'ice' | 'gaap'
  | 'consol' | 'reporting' | 'fs' | 'bridges' | 'disclosure' | 'library' | 'disclib'
  | 'notes' | 'wnote' | 'org' | 'team' | 'reach' | 'help' | 'settings'
  | 'proforma' | 'carve' | 'buscomb'
  | 'mytasks' | 'userguide' | 'feedback';

type RouteMeta = { label: string; glyph: string; section: string };

export const routes: Record<RouteKey, RouteMeta> = {
  // Top
  home:       { label: 'Home',                       glyph: 'M4 11 12 4l8 7M6 9.8V20h4.5v-5h3v5H18V9.8', section: 'Top' },
  workspace:  { label: 'My Workspace',               glyph: 'M4 4.5h6.5V11H4zM13.5 4.5H20v4h-6.5zM13.5 12H20v7.5h-6.5zM4 14.5h6.5v5H4z', section: 'Top' },

  // Teams
  access:     { label: 'Manage Teams',               glyph: 'M9 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20c0-3.4 2.9-5 6.5-5s6.5 1.6 6.5 5M16 4.5a3.5 3.5 0 0 1 0 6.5M17.5 15.2c2.5.7 4 2.1 4 4.8', section: 'Teams' },
  mytasks:    { label: 'My Tasks',                   glyph: 'M4 6.5h3l1.5 1.5L12 4M4 13h3l1.5 1.5L12 10.5M4 19.5h3L8.5 21 12 17M14 6.5h6M14 13h6M14 19.5h6', section: 'Teams' },

  // Module Integration (collapsible)
  buscomb:    { label: 'PPA Accounting',             glyph: 'M3 5h3.5l4.5 6.5M3 19h3.5L11 12.5M11 12h9M20 12l-3.2-3.2M20 12l-3.2 3.2', section: 'Module Integration' },
  proforma:   { label: 'Proformas',                  glyph: 'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5', section: 'Module Integration' },
  gaap:       { label: 'GAAP Conversion',            glyph: 'M8 3 4 7l4 4M4 7h16M16 13l4 4-4 4M20 17H4', section: 'Module Integration' },
  carve:      { label: 'Divestiture',                glyph: 'M4 4h9v16H4zM16 4h4v5h-4zM18 11.5v7.5M18 19l2.4-2.4M18 19l-2.4-2.4', section: 'Module Integration' },

  // Disclosure insights (single-item parent)
  disclib:    { label: 'Disclosure insights',        glyph: 'M12 3l7 2.5v6c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5v-6zM9.5 11.8l1.9 1.9 3.6-3.9', section: 'Disclosure insights' },

  // Bottom
  userguide:  { label: 'User Instructions',          glyph: 'M5 4h9l5 5v11H5zM14 4v5h5M9 13h6M9 17h4', section: 'Bottom' },
  feedback:   { label: 'Feedback Form',              glyph: 'm12 3 2.7 5.5 6 .9-4.3 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.4l6-.9z', section: 'Bottom' },
  reach:      { label: 'Reach Us',                   glyph: 'M4 5h16v14H4zM4 6l8 6 8-6', section: 'Bottom' },

  // Routes not in sidebar — navigable via workspace tiles, stepper, breadcrumbs
  command:    { label: 'Command Center',             glyph: 'M12 15l4-6M4 15a8 8 0 0 1 16 0M3 20h18', section: 'Workspace' },
  engagement: { label: 'Engagement Setup',           glyph: 'M9 4h6v3H9zM9 4H6v17h12V4h-3M9 12h6M9 16h4', section: 'Workspace' },
  entities:   { label: 'Legal Entity Master',        glyph: 'M12 3c-4.4 0-8 1.4-8 3.2v11.6C4 19.6 7.6 21 12 21s8-1.4 8-3.2V6.2C20 4.4 16.4 3 12 3z', section: 'Engagement Setup' },
  intake:     { label: 'Project Intake Form',        glyph: 'M4 20l1-4L16 5l3 3L8 19l-4 1zM13 8l3 3', section: 'Projects' },
  upload:     { label: 'Financial Data Layer',       glyph: 'M12 15V4M7 8l5-4 5 4M4 20h16', section: 'Engagement Setup' },
  tb:         { label: 'Trial Balance',              glyph: 'M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z', section: 'Data' },
  atb:        { label: 'Adjusted Trial Balance',     glyph: 'M4 4h16v16H4z', section: 'Data' },
  fslimap:    { label: 'FSLI Mapping',               glyph: 'M4 6h6v6H4zM14 6h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', section: 'Data' },
  fx:         { label: 'Currency Translation',       glyph: 'M4 7h14l-3.5-3.5M20 17H6l3.5 3.5', section: 'Workspace' },
  ice:        { label: 'Intercompany (ICE)',         glyph: 'M12 4 3 20h18L12 4zM12 10v5M12 17.5v.5', section: 'Workspace' },
  consol:     { label: 'Consolidation Cycle',        glyph: 'M20 12a8 8 0 1 1-2.3-5.7M20 3v6h-6', section: 'Workspace' },
  reporting:  { label: 'Reporting Hub',              glyph: 'M4 20h16M7 16v-6M12 16V6M17 16v-3', section: 'Output & Reporting' },
  fs:         { label: 'Single-Entity FS',           glyph: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6', section: 'Output & Reporting' },
  bridges:    { label: 'Bridge Reports',             glyph: 'M3 17h18M3 8h18M7 8v9M12 8v9M17 8v9', section: 'Output & Reporting' },
  disclosure: { label: 'Disclosure Sentinel',        glyph: 'M12 3l7 2.5v6c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5v-6zM9 12l2.2 2.2L15.5 10', section: 'Reporting & Analytics' },
  library:    { label: 'Disclosure Library',         glyph: 'M4 4h6v16H4zM12 4h8v16h-8z', section: 'Reporting & Analytics' },
  notes:      { label: 'Notes & Disclosures',        glyph: 'M6 3h9l5 5v13H6z', section: 'Reporting & Analytics' },
  wnote:      { label: 'Working Note',               glyph: 'M4 4h16v16H4z', section: 'Reporting & Analytics' },
  org:        { label: 'Org Chart',                  glyph: 'M12 3v4M6 11v4M18 11v4M4 7h16', section: 'Engagement Setup' },
  team:       { label: 'Team',                       glyph: 'M8 8a4 4 0 108 0 4 4 0 00-8 0zM2 20a6 6 0 0120 0', section: 'Teams' },
  help:       { label: 'Help',                       glyph: 'M12 18h.01M9 9a3 3 0 116 0c0 2-3 2-3 5', section: 'Bottom' },
  settings:   { label: 'Settings',                   glyph: 'M4 8h9M17 8h3M13 5v6M4 16h3M11 16h9M7 13v6', section: 'Bottom' },
};

export const sectionOrder = ['Top', 'Teams', 'Module Integration', 'Disclosure insights', 'Bottom'] as const;

export const parentSections: string[] = ['Top', 'Teams', 'Disclosure insights', 'Bottom'];

export const sectionIcons: Record<string, string> = {
  Top:                    'M4 11 12 4l8 7M6 9.8V20h4.5v-5h3v5H18V9.8',
  Teams:                  'M9 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2 20c0-3.5 3-5 7-5s7 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18.5 15.2c2.1.7 3.5 2 3.5 4.8',
  'Module Integration':   'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13.5v6M13.5 16.5h6',
  'Disclosure insights':  'M12 3l7 2.5v6c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5v-6zM9.5 11.8l1.9 1.9 3.6-3.9',
  Bottom:                 'M4 8h9M17 8h3M13 5v6M4 16h3M11 16h9M7 13v6',
};

export const stepperRoutes: RouteKey[] = ['consol', 'gaap', 'reporting', 'fs', 'bridges'];

export const navHide: RouteKey[] = [];

export type StepStatus = 'done' | 'active' | 'todo' | 'warn';
export type StepDef = { key: string; label: string; status: StepStatus };

export const stepperDefs: StepDef[] = [
  { key: 'tb',      label: 'Trial Balance',      status: 'done' },
  { key: 'map',     label: 'FSLI Mapping',       status: 'done' },
  { key: 'atb',     label: 'Adjustments',        status: 'active' },
  { key: 'fx',      label: 'FX Translation',     status: 'todo' },
  { key: 'ic',      label: 'Intercompany',       status: 'warn' },
  { key: 'gaap',    label: 'GAAP',               status: 'todo' },
  { key: 'consol',  label: 'Consolidation',      status: 'todo' },
  { key: 'report',  label: 'Reporting',          status: 'todo' },
];
