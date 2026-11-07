const FILENAMES: Record<string, string> = {
  cards: 'board-cards.csv',
  groups: 'board-groups.csv',
  mapping: 'board-mapping.csv',
};

export type ExportType = 'cards' | 'groups' | 'mapping';

export async function downloadBoardExport(type: ExportType): Promise<void> {
  const response = await fetch(`/api/board/export?type=${encodeURIComponent(type)}`);
  if (!response.ok) {
    let detail = `Export failed (${response.status})`;
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') detail = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILENAMES[type] || `board-${type}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
