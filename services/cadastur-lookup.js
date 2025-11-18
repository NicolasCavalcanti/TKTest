"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cadasturLookupService = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const error_1 = require("../middlewares/error");
const normalizeCadastur_js_1 = require("../../../shared/normalizeCadastur.js");
const CACHE_TTL_MS = 15 * 60 * 1000;
const FILE_NAMES = ['BD_CADASTUR.csv', 'CADASTUR.csv'];
const DELIMITERS = [',', ';', '\t', '|'];
const NAME_HEADER_CANDIDATES = [
    'NOME_COMPLETO',
    'NOME',
    'NOME_COMPLETO_DO_GUIA',
    'NOME_DO_GUIA',
];
const NUMBER_HEADER_CANDIDATES = [
    'NUMERO_CADASTUR',
    'NUMERO_DO_CADASTUR',
    'NUMERO_DO_CERTIFICADO',
    'NUMERO_CADASTRU',
];
let cachedLookup = null;
let cacheTimestamp = 0;
const uniqueDirectories = (paths) => {
    return Array.from(new Set(paths.map((item) => node_path_1.default.resolve(item))));
};
const candidateDirectories = uniqueDirectories([
    process.cwd(),
    node_path_1.default.resolve(process.cwd(), 'public'),
    node_path_1.default.resolve(process.cwd(), 'static'),
    node_path_1.default.resolve(process.cwd(), '..'),
    '/var/www/html',
    node_path_1.default.resolve(__dirname, '..'),
    node_path_1.default.resolve(__dirname, '../..'),
    node_path_1.default.resolve(__dirname, '../../..'),
]);
const normalizeHeader = (value) => value
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
const normalizeNumber = (value) => value.replace(/\D/g, '');
const detectDelimiter = (line) => {
    let bestDelimiter = ';';
    let bestCount = -1;
    for (const delimiter of DELIMITERS) {
        const count = line.split(delimiter).length - 1;
        if (count > bestCount) {
            bestCount = count;
            bestDelimiter = delimiter;
        }
    }
    return bestDelimiter;
};
const parseCsvLine = (line, delimiter) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    result.push(current);
    return result;
};
const findColumnIndex = (headers, candidates) => {
    for (const candidate of candidates) {
        const index = headers.indexOf(candidate);
        if (index !== -1) {
            return index;
        }
    }
    return -1;
};
const resolveCadasturFile = async () => {
    const customPath = process.env.CADASTUR_CSV_PATH;
    if (customPath) {
        const resolvedCustomPath = node_path_1.default.resolve(customPath);
        try {
            await (0, promises_1.access)(resolvedCustomPath);
            console.info('[cadasturLookupService] Base CADASTUR localizada via CADASTUR_CSV_PATH:', resolvedCustomPath);
            return resolvedCustomPath;
        }
        catch (error) {
            console.warn('[cadasturLookupService] Caminho definido em CADASTUR_CSV_PATH indisponível:', resolvedCustomPath, error instanceof Error ? error.message : error);
        }
    }
    for (const directory of candidateDirectories) {
        for (const fileName of FILE_NAMES) {
            const candidate = node_path_1.default.resolve(directory, fileName);
            try {
                await (0, promises_1.access)(candidate);
                console.info('[cadasturLookupService] Base CADASTUR localizada em diretório candidato:', candidate);
                return candidate;
            }
            catch {
                // Continue searching in next candidate
            }
        }
    }
    throw new error_1.HttpError(500, 'CADASTUR_DATA_UNAVAILABLE', 'Base oficial CADASTUR não encontrada no servidor');
};
const parseCadasturCsv = (content, sourcePath) => {
    const sanitized = content.replace(/\r/g, '\n');
    const lines = sanitized
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length === 0) {
        return {
            namesByNumber: new Map(),
            total: 0,
            sourcePath,
        };
    }
    const headerLine = lines.shift()?.replace(/^\uFEFF/, '') ?? '';
    const delimiter = detectDelimiter(headerLine);
    const headers = parseCsvLine(headerLine, delimiter).map((header) => normalizeHeader(header));
    const nameIndex = findColumnIndex(headers, NAME_HEADER_CANDIDATES);
    const numberIndex = findColumnIndex(headers, NUMBER_HEADER_CANDIDATES);
    if (nameIndex === -1 || numberIndex === -1) {
        throw new Error('Colunas obrigatórias ausentes na base CADASTUR');
    }
    const namesByNumber = new Map();
    let total = 0;
    for (const rawLine of lines) {
        const values = parseCsvLine(rawLine, delimiter);
        if (values.length <= Math.max(nameIndex, numberIndex)) {
            continue;
        }
        const rawName = values[nameIndex]?.trim();
        const rawNumber = values[numberIndex]?.trim();
        if (!rawName || !rawNumber) {
            continue;
        }
        const normalizedNumber = normalizeNumber(rawNumber);
        const normalizedName = (0, normalizeCadastur_js_1.normalizeNameForCadastur)(rawName);
        if (!normalizedNumber || !normalizedName) {
            continue;
        }
        if (!namesByNumber.has(normalizedNumber)) {
            namesByNumber.set(normalizedNumber, []);
        }
        namesByNumber.get(normalizedNumber)?.push({
            rawName,
            normalizedName,
        });
        total += 1;
    }
    return {
        namesByNumber,
        total,
        sourcePath,
    };
};
const loadCadasturLookup = async () => {
    const now = Date.now();
    if (cachedLookup && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedLookup;
    }
    const filePath = await resolveCadasturFile();
    let content;
    try {
        content = await (0, promises_1.readFile)(filePath, 'utf-8');
    }
    catch (error) {
        throw new error_1.HttpError(500, 'CADASTUR_FILE_READ_ERROR', 'Não foi possível ler o arquivo da base CADASTUR', error instanceof Error ? error.message : undefined);
    }
    let parsed;
    try {
        parsed = parseCadasturCsv(content, filePath);
    }
    catch (error) {
        throw new error_1.HttpError(500, 'CADASTUR_DATA_INVALID', 'Base oficial CADASTUR inválida ou corrompida', error instanceof Error ? error.message : undefined);
    }
    if (parsed.namesByNumber.size === 0) {
        throw new error_1.HttpError(500, 'CADASTUR_DATA_EMPTY', 'Base oficial CADASTUR vazia');
    }
    console.info('[cadasturLookupService] Base CADASTUR carregada com sucesso:', JSON.stringify({ source: filePath, registros: parsed.total }));
    cachedLookup = parsed;
    cacheTimestamp = now;
    return parsed;
};
const createValidationResult = (overrides) => ({
    valid: false,
    exactMatch: false,
    numberExists: false,
    matchedName: null,
    normalizedMatchedName: null,
    availableNames: [],
    ...overrides,
});
exports.cadasturLookupService = {
    async validate(name, cadasturNumber) {
        const lookup = await loadCadasturLookup();
        const normalizedNumber = normalizeNumber(cadasturNumber);
        const normalizedInputName = (0, normalizeCadastur_js_1.normalizeNameForCadastur)(name);
        if (!normalizedNumber) {
            return createValidationResult({ numberExists: false });
        }
        const entries = lookup.namesByNumber.get(normalizedNumber);
        if (!entries || entries.length === 0) {
            return createValidationResult({ numberExists: false });
        }
        const availableNames = entries.map((entry) => entry.rawName);
        if (!normalizedInputName) {
            return createValidationResult({ numberExists: true, availableNames });
        }
        const exactMatch = entries.find((entry) => entry.normalizedName === normalizedInputName);
        if (exactMatch) {
            return createValidationResult({
                valid: true,
                exactMatch: true,
                numberExists: true,
                matchedName: exactMatch.rawName,
                normalizedMatchedName: exactMatch.normalizedName,
                availableNames,
            });
        }
        const partialMatch = entries.find((entry) => (0, normalizeCadastur_js_1.isNormalizedCadasturNameLooseMatch)(normalizedInputName, entry.normalizedName));
        if (partialMatch) {
            return createValidationResult({
                valid: true,
                exactMatch: false,
                numberExists: true,
                matchedName: partialMatch.rawName,
                normalizedMatchedName: partialMatch.normalizedName,
                availableNames,
            });
        }
        return createValidationResult({ numberExists: true, availableNames });
    },
    async refresh() {
        cachedLookup = null;
        cacheTimestamp = 0;
        try {
            await loadCadasturLookup();
        }
        catch {
            // ignore refresh errors, next validation will report them
        }
    },
    get cachedSource() {
        return cachedLookup?.sourcePath ?? null;
    },
};
//# sourceMappingURL=cadastur-lookup.js.map