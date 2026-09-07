export type ProjectNavigationSettings = {
  planning?: { enabled?: boolean };
  finance?: { trackFinance?: boolean };
  quality?: { defectManagement?: boolean };
  releaseManagement?: { enabled?: boolean };
  collaboration?: { workspaceEnabled?: boolean };
};

export type ProjectNavigationItem = {
  id: string;
  [key: string]: unknown;
};

export function filterProjectNavigation<T extends ProjectNavigationItem>(
  items: T[],
  settings?: ProjectNavigationSettings,
): T[] {
  if (!settings) return items;

  return items.filter((item) => {
    if (item.id === "planning" && settings.planning?.enabled === false) return false;
    if (item.id === "workspace" && settings.collaboration?.workspaceEnabled === false) return false;
    if (item.id === "defects" && settings.quality?.defectManagement === false) return false;
    if (item.id === "release" && settings.releaseManagement?.enabled === false) return false;
    if (item.id === "finance" && settings.finance?.trackFinance === false) return false;
    return true;
  });
}