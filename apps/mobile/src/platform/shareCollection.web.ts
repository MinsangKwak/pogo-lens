export async function shareCollectionJSON(json: string): Promise<void> {
  const blob = new Blob([json], {type: 'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pogo-lens-records.json';
  link.style.display = 'none';
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
