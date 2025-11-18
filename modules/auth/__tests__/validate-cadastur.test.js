"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const app_1 = require("../../../app");
const cadastur_lookup_1 = require("../../../services/cadastur-lookup");
describe('POST /api/auth/validate-cadastur', () => {
    let server;
    let port;
    const makeRequest = (path, options = {}) => {
        const method = options.method ?? 'GET';
        const headers = options.headers ?? {};
        const body = options.body ?? '';
        return new Promise((resolve, reject) => {
            const request = node_http_1.default.request({
                hostname: '127.0.0.1',
                port,
                path,
                method,
                headers: {
                    ...headers,
                    ...(body && !headers['content-length']
                        ? { 'content-length': Buffer.byteLength(body).toString() }
                        : {}),
                },
            }, (response) => {
                const chunks = [];
                response.on('data', (chunk) => {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                });
                response.on('end', () => {
                    resolve({
                        status: response.statusCode ?? 0,
                        headers: response.headers,
                        body: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            });
            request.on('error', reject);
            if (body) {
                request.write(body);
            }
            request.end();
        });
    };
    const fetchCsrfBundle = async () => {
        const response = await makeRequest('/api/healthz');
        const rawCookies = response.headers['set-cookie'];
        const cookies = Array.isArray(rawCookies)
            ? rawCookies
            : rawCookies
                ? [rawCookies]
                : [];
        const csrfCookie = cookies.find((cookie) => cookie.startsWith('csrfToken='));
        const token = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';
        return { token, cookies };
    };
    const postValidation = async (payload) => {
        const csrf = await fetchCsrfBundle();
        const body = JSON.stringify(payload);
        const response = await makeRequest('/api/auth/validate-cadastur', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-csrf-token': csrf.token,
                cookie: csrf.cookies.join('; '),
            },
            body,
        });
        const data = JSON.parse(response.body);
        return { response, data };
    };
    beforeAll(async () => {
        await cadastur_lookup_1.cadasturLookupService.refresh();
        server = node_http_1.default.createServer(app_1.app);
        await new Promise((resolve) => {
            server.listen(0, () => resolve());
        });
        const address = server.address();
        port = address.port;
    });
    afterAll(async () => {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    });
    it('confirms exact matches', async () => {
        const { response, data } = await postValidation({
            name: 'Julieli Ferrari dos Santos',
            cadastur_number: '21467985879',
        });
        expect(response.status).toBe(200);
        expect(data).toMatchObject({
            valid: true,
            exact_match: true,
            official_name: 'JULIELI FERRARI DOS SANTOS',
        });
    });
    it('returns partial matches when particles differ', async () => {
        const { response, data } = await postValidation({
            name: 'Julieli Ferrari Santos',
            cadastur_number: '21467985879',
        });
        expect(response.status).toBe(200);
        expect(data.valid).toBe(true);
        expect(data.exact_match).toBe(false);
        expect(data.official_name).toBe('JULIELI FERRARI DOS SANTOS');
    });
    it('rejects mismatched names for existing numbers', async () => {
        const { response, data } = await postValidation({
            name: 'Outra Pessoa',
            cadastur_number: '21467985879',
        });
        expect(response.status).toBe(409);
        expect(data.valid).toBe(false);
        expect(data.code).toBe('CADASTUR_NAME_MISMATCH');
    });
    it('returns not found when number does not exist', async () => {
        const { response, data } = await postValidation({
            name: 'Qualquer Nome',
            cadastur_number: '00000000000',
        });
        expect(response.status).toBe(404);
        expect(data.code).toBe('CADASTUR_NUMBER_NOT_FOUND');
    });
    it('validates number length', async () => {
        const { response, data } = await postValidation({
            name: 'Qualquer Nome',
            cadastur_number: '1234567890',
        });
        expect(response.status).toBe(400);
        expect(data.valid).toBe(false);
    });
});
//# sourceMappingURL=validate-cadastur.test.js.map