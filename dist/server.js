"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv = __importStar(require("dotenv"));
const gemini_1 = require("./services/gemini");
dotenv.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.post('/api/market-signals', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = yield (0, gemini_1.fetchMarketSignals)();
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/api/rebalancer/explanation', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { input, analysis } = req.body;
        const data = yield (0, gemini_1.generateRebalancerExplanation)(input, analysis);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/api/tickers/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { query } = req.body;
        const data = yield (0, gemini_1.searchTickers)(query);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/api/portfolio/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const input = req.body;
        const data = yield (0, gemini_1.generatePortfolio)(input);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
app.post('/api/portfolio/analyze', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { holdings, years, targetAllocation, currentValues } = req.body;
        const data = yield (0, gemini_1.analyzeExistingPortfolio)(holdings, years, targetAllocation, currentValues);
        res.json(data);
    }
    catch (error) {
        console.error("Error in /api/portfolio/analyze:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
}));
// Payment Routes
const payment_1 = require("./services/payment");
app.post('/api/payment/create-order', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { amount, receipt } = req.body;
        const order = yield (0, payment_1.createOrder)(amount, 'INR', receipt);
        res.json(order);
    }
    catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: error.message });
    }
}));
app.post('/api/payment/verify', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const isValid = (0, payment_1.verifyPaymentSignature)(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (isValid) {
            res.json({ status: 'success' });
        }
        else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    }
    catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
}));
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
