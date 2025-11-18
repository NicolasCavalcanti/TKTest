"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = void 0;
const uuid_1 = require("uuid");
const REQUEST_ID_HEADER = 'x-request-id';
const requestId = (req, res, next) => {
    const headerId = req.headers[REQUEST_ID_HEADER] ??
        req.headers['x-correlation-id'];
    const id = headerId && headerId.trim().length > 0 ? headerId : (0, uuid_1.v4)();
    req.requestId = id;
    res.locals.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
};
exports.requestId = requestId;
//# sourceMappingURL=request-id.js.map