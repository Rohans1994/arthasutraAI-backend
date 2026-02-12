import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import {
    fetchMarketSignals,
    generateRebalancerExplanation,
    searchTickers,
    generatePortfolio,
    analyzeExistingPortfolio
} from './services/gemini';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.post('/api/market-signals', async (req, res) => {
    try {
        const data = await fetchMarketSignals();
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rebalancer/explanation', async (req, res) => {
    try {
        const { input, analysis } = req.body;
        const data = await generateRebalancerExplanation(input, analysis);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tickers/search', async (req, res) => {
    try {
        const { query } = req.body;
        const data = await searchTickers(query);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/portfolio/generate', async (req, res) => {
    try {
        const input = req.body;
        const data = await generatePortfolio(input);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/portfolio/analyze', async (req, res) => {
    try {
        const { holdings, years, targetAllocation, currentValues } = req.body;
        const data = await analyzeExistingPortfolio(holdings, years, targetAllocation, currentValues);
        res.json(data);
    } catch (error: any) {
        console.error("Error in /api/portfolio/analyze:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});


// Payment Routes
import { createOrder, verifyPaymentSignature } from './services/payment';

app.post('/api/payment/create-order', async (req, res) => {
    try {
        const { amount, receipt } = req.body;
        const order = await createOrder(amount, 'INR', receipt);
        res.json(order);
    } catch (error: any) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payment/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (isValid) {
            res.json({ status: 'success' });
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error: any) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
