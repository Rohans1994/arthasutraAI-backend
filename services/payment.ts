
import Razorpay from 'razorpay';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay credentials missing in enviromment variables.");
}

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

export async function createOrder(amount: number, currency: string = 'INR', receipt: string) {
    try {
        const options = {
            amount: amount * 100, // Razorpay works in subunits (paise)
            currency,
            receipt,
        };
        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw error;
    }
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
    const text = orderId + "|" + paymentId;
    const generated_signature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET || "")
        .update(text.toString())
        .digest("hex");

    return generated_signature === signature;
}
