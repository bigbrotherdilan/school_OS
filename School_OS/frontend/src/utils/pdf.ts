import { api } from '../services/api';

/**
 * Fetch a PDF (or any binary) as a Blob using the authenticated axios instance,
 * then trigger a browser download.
 */
export async function downloadPdf(url: string, filename: string): Promise<void> {
    const res = await api.get(url, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
}

/**
 * Fetch a PDF as a Blob using the authenticated axios instance and open it in a
 * new tab where the user can view and print it directly.
 */
export async function openPdfInNewTab(url: string, fallbackFilename?: string): Promise<void> {
    const res = await api.get(url, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const win = window.open(blobUrl, '_blank');
    if (!win) {
        window.location.href = blobUrl;
        return;
    }
    if (fallbackFilename) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fallbackFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}
