import { Platform } from 'react-native';

/** Public upload service (not the attendance API base URL). */
export const ONESAAS_UPLOAD_URL = 'https://upload.onesaas.in/api/upload';

/** Header `key` required by the upload service. */
export const ONESAAS_UPLOAD_KEY = 'onedevelopers';

export type OneSaasUploadMeta = {
    id?: string;
    originalName?: string;
    storedName?: string;
    mimeType?: string;
    size?: number;
    sizeOnDisk?: number;
    checksumSha256?: string;
    uploadedAt?: string;
    relativePath?: string;
};

export type OneSaasUploadSuccessResponse = {
    success: true;
    url: string;
    meta?: OneSaasUploadMeta;
};

export type OneSaasUploadErrorResponse = {
    success: false;
    message?: string;
};

export type OneSaasUploadResponse = OneSaasUploadSuccessResponse | OneSaasUploadErrorResponse;

export type UploadableFile = {
    /** Local file URI from image picker (`file://` on iOS, `content://` / `file://` on Android). */
    uri: string;
    mimeType: string;
    fileName: string;
};

const UPLOAD_LOG = '[OneSaaS upload]';

function uriSchemeForLog(rawUri: string): string {
    const idx = rawUri.indexOf(':');
    return idx === -1 ? '(no scheme)' : `${rawUri.slice(0, idx)}:`;
}

/**
 * Uploads a file to OneSaaS public upload API (multipart `file` field).
 * Returns the public `url` on success. Throws with a readable message on failure or unexpected HTTP status.
 *
 * Uses `fetch` (native OkHttp on Android) instead of axios: axios often surfaces multipart
 * uploads as `ERR_NETWORK` with no response on RN because it goes through XMLHttpRequest.
 */
export async function uploadFileToOneSaas(file: UploadableFile): Promise<string> {
    const uri =
        Platform.OS === 'ios' && file.uri.startsWith('file://')
            ? file.uri.replace('file://', '')
            : file.uri;

    const form = new FormData();
    form.append('file', {
        uri,
        name: file.fileName || 'upload.jpg',
        type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);

    console.log(UPLOAD_LOG, 'POST (fetch)', ONESAAS_UPLOAD_URL, {
        platform: Platform.OS,
        fileName: file.fileName,
        mimeType: file.mimeType,
        uriScheme: uriSchemeForLog(file.uri),
    });

    let status = 0;
    let data: OneSaasUploadResponse | undefined;
    let responseText = '';
    try {
        const res = await fetch(ONESAAS_UPLOAD_URL, {
            method: 'POST',
            headers: {
                key: ONESAAS_UPLOAD_KEY,
            },
            body: form,
        });
        status = res.status;
        responseText = await res.text();
        console.log(UPLOAD_LOG, 'HTTP response', {
            status,
            bodyPreview: responseText.length > 800 ? `${responseText.slice(0, 800)}…` : responseText,
        });
        if (responseText.trim()) {
            try {
                data = JSON.parse(responseText) as OneSaasUploadResponse;
            } catch {
                console.log(UPLOAD_LOG, 'reject: response is not JSON');
                throw new Error('Invalid upload response (not JSON)');
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(UPLOAD_LOG, 'fetch threw (network / TLS / DNS)', { message, err });
        throw err instanceof Error ? err : new Error(message);
    }

    const httpOk = status === 200 || status === 201;
    if (!httpOk) {
        const msg =
            data && typeof data === 'object' && 'message' in data && typeof (data as OneSaasUploadErrorResponse).message === 'string'
                ? (data as OneSaasUploadErrorResponse).message
                : `Upload failed (${status})`;
        console.log(UPLOAD_LOG, 'reject: unexpected HTTP status', { status, data, derivedMessage: msg });
        throw new Error(msg);
    }

    if (!data || typeof data !== 'object') {
        console.log(UPLOAD_LOG, 'reject: invalid or empty body', { responseTextPreview: responseText?.slice?.(0, 200) });
        throw new Error('Invalid upload response');
    }

    if (!('success' in data) || data.success !== true) {
        const msg =
            'message' in data && typeof (data as OneSaasUploadErrorResponse).message === 'string'
                ? (data as OneSaasUploadErrorResponse).message
                : 'Upload failed';
        console.log(UPLOAD_LOG, 'reject: success !== true', { data, derivedMessage: msg });
        throw new Error(msg);
    }

    const url = (data as OneSaasUploadSuccessResponse).url?.trim();
    if (!url) {
        console.log(UPLOAD_LOG, 'reject: missing url in success body', { data });
        throw new Error('Upload succeeded but no URL was returned');
    }

    console.log(UPLOAD_LOG, 'ok', { urlLength: url.length });
    return url;
}
