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
exports.createOrder = createOrder;
exports.verifyPaymentSignature = verifyPaymentSignature;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay credentials missing in enviromment variables.");
}
const razorpay = new razorpay_1.default({
    key_id: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: RAZORPAY_KEY_SECRET || 'secret_placeholder'
});
function createOrder(amount_1) {
    return __awaiter(this, arguments, void 0, function* (amount, currency = 'INR', receipt) {
        try {
            const options = {
                amount: amount * 100, // Razorpay works in subunits (paise)
                currency,
                receipt,
            };
            const order = yield razorpay.orders.create(options);
            return order;
        }
        catch (error) {
            console.error("Error creating Razorpay order:", error);
            throw error;
        }
    });
}
function verifyPaymentSignature(orderId, paymentId, signature) {
    const text = orderId + "|" + paymentId;
    const generated_signature = crypto_1.default
        .createHmac("sha256", RAZORPAY_KEY_SECRET || "")
        .update(text.toString())
        .digest("hex");
    return generated_signature === signature;
}
