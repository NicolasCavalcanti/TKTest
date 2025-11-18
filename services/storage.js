"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorageServiceFromEnv = exports.StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_s3_2 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
class StorageService {
    client;
    bucket;
    basePath;
    publicBaseUrl;
    constructor(config, options) {
        this.client = new client_s3_1.S3Client(config);
        this.bucket = options.bucket;
        this.basePath = options.basePath;
        this.publicBaseUrl = options.publicBaseUrl;
    }
    buildObjectKey(fileName) {
        const extension = fileName ? (0, node_path_1.extname)(fileName).toLowerCase() : '';
        const sanitizedExtension = extension.replace(/[^a-z0-9.]/g, '');
        const uniqueName = `${(0, node_crypto_1.randomUUID)()}${sanitizedExtension}`;
        const segments = [this.basePath, uniqueName].filter((segment) => Boolean(segment && segment.length > 0));
        return segments.join('/');
    }
    buildPublicUrl(key) {
        if (this.publicBaseUrl) {
            const trimmed = this.publicBaseUrl.replace(/\/+$|^\/+/, '');
            if (trimmed.length === 0) {
                return `https://${this.bucket}.s3.amazonaws.com/${key}`;
            }
            return `${trimmed}/${key}`;
        }
        return `https://${this.bucket}.s3.amazonaws.com/${key}`;
    }
    async createPresignedUpload(contentType, options = {}) {
        const key = this.buildObjectKey(options.fileName);
        const command = new client_s3_2.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
            Metadata: options.metadata,
            ContentDisposition: options.contentDisposition,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.client, command, {
            expiresIn: options.expiresInSeconds ?? 900,
        });
        return {
            key,
            uploadUrl,
            publicUrl: this.buildPublicUrl(key),
        };
    }
}
exports.StorageService = StorageService;
const createStorageServiceFromEnv = () => {
    const bucket = process.env.STORAGE_BUCKET;
    if (!bucket) {
        throw new Error('STORAGE_BUCKET is not configured');
    }
    const region = process.env.STORAGE_REGION ?? 'auto';
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const basePath = process.env.STORAGE_BASE_PATH;
    const publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL;
    const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE === 'true';
    const config = {
        region,
    };
    if (endpoint) {
        config.endpoint = endpoint;
    }
    if (accessKeyId && secretAccessKey) {
        config.credentials = { accessKeyId, secretAccessKey };
    }
    if (forcePathStyle) {
        config.forcePathStyle = true;
    }
    return new StorageService(config, {
        bucket,
        basePath,
        publicBaseUrl,
    });
};
exports.createStorageServiceFromEnv = createStorageServiceFromEnv;
//# sourceMappingURL=storage.js.map