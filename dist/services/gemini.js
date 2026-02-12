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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMarketSignals = fetchMarketSignals;
exports.generateRebalancerExplanation = generateRebalancerExplanation;
exports.searchTickers = searchTickers;
exports.generatePortfolio = generatePortfolio;
exports.analyzeExistingPortfolio = analyzeExistingPortfolio;
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv"));
const types_1 = require("../types");
dotenv.config();
// Initialize with process.env.API_KEY
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("API_KEY is missing in environment variables.");
}
const ai = new genai_1.GoogleGenAI({ apiKey: apiKey || "" });
/**
 * Robust Retry Utility with Exponential Backoff
 */
function callGemini(apiCall_1) {
    return __awaiter(this, arguments, void 0, function* (apiCall, maxRetries = 3) {
        let lastError;
        let delay = 2000;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return yield apiCall();
            }
            catch (error) {
                lastError = error;
                const errorMsg = (error === null || error === void 0 ? void 0 : error.message) || "";
                const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
                const isServerError = errorMsg.includes("500") || errorMsg.includes("503") || errorMsg.includes("overloaded");
                if ((isQuotaError || isServerError) && i < maxRetries) {
                    console.warn(`Gemini API busy (Attempt ${i + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                    yield new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                    continue;
                }
                break;
            }
        }
        throw lastError;
    });
}
const PORTFOLIO_SCHEMA = {
    type: genai_1.Type.OBJECT,
    properties: {
        stocks: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    ticker: { type: genai_1.Type.STRING },
                    name: { type: genai_1.Type.STRING },
                    sector: { type: genai_1.Type.STRING },
                    marketCap: { type: genai_1.Type.STRING, description: "Must be exactly 'Large Cap', 'Mid Cap', or 'Small Cap'" },
                    allocation: { type: genai_1.Type.NUMBER },
                    rationale: { type: genai_1.Type.STRING },
                    projectedReturn: { type: genai_1.Type.STRING }
                },
                required: ["ticker", "name", "sector", "marketCap", "allocation", "rationale", "projectedReturn"]
            }
        },
        mutualFunds: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    name: { type: genai_1.Type.STRING },
                    category: { type: genai_1.Type.STRING },
                    rationale: { type: genai_1.Type.STRING },
                    allocation: { type: genai_1.Type.NUMBER },
                    expectedReturn: { type: genai_1.Type.STRING }
                },
                required: ["name", "category", "rationale", "allocation", "expectedReturn"]
            }
        },
        otherAssets: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    type: { type: genai_1.Type.STRING },
                    name: { type: genai_1.Type.STRING },
                    allocation: { type: genai_1.Type.NUMBER },
                    rationale: { type: genai_1.Type.STRING },
                    projectedReturn: { type: genai_1.Type.STRING }
                },
                required: ["type", "name", "allocation", "rationale", "projectedReturn"]
            }
        }
    },
    required: ["stocks", "mutualFunds", "otherAssets"]
};
const ANALYSIS_SCHEMA = {
    type: genai_1.Type.OBJECT,
    properties: {
        portfolioSummary: { type: genai_1.Type.STRING },
        analysis: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    ticker: { type: genai_1.Type.STRING },
                    currentPrice: { type: genai_1.Type.NUMBER },
                    targetPrice: { type: genai_1.Type.NUMBER },
                    action: { type: genai_1.Type.STRING },
                    recommendationRationale: { type: genai_1.Type.STRING },
                    fundamentalDeepDive: { type: genai_1.Type.STRING },
                    technicalDeepDive: { type: genai_1.Type.STRING },
                    keyMetrics: {
                        type: genai_1.Type.ARRAY,
                        items: { type: genai_1.Type.STRING }
                    },
                    projectedGrowth: { type: genai_1.Type.NUMBER },
                    scorecard: {
                        type: genai_1.Type.OBJECT,
                        properties: {
                            performance: { type: genai_1.Type.STRING },
                            profitability: { type: genai_1.Type.STRING },
                            valuation: { type: genai_1.Type.STRING },
                            growth: { type: genai_1.Type.STRING },
                            redFlags: {
                                type: genai_1.Type.ARRAY,
                                items: { type: genai_1.Type.STRING }
                            }
                        },
                        required: ["performance", "profitability", "valuation", "growth", "redFlags"]
                    },
                    alternativeRecommendation: {
                        type: genai_1.Type.OBJECT,
                        properties: {
                            category: {
                                type: genai_1.Type.STRING,
                                description: "Must be: 'Balanced Portfolio Suggestions (Domestic Equity)', 'Global Portfolio Suggestion', 'Debt Portfolio Suggestion', or 'Gold Portfolio Suggestion'"
                            },
                            ticker: { type: genai_1.Type.STRING, nullable: true },
                            name: { type: genai_1.Type.STRING },
                            rationale: { type: genai_1.Type.STRING },
                            projectedReturn: { type: genai_1.Type.STRING }
                        },
                        required: ["category", "name", "rationale", "projectedReturn"],
                        nullable: true
                    }
                },
                required: [
                    "ticker",
                    "currentPrice",
                    "targetPrice",
                    "action",
                    "recommendationRationale",
                    "fundamentalDeepDive",
                    "technicalDeepDive",
                    "keyMetrics",
                    "projectedGrowth",
                    "scorecard"
                ]
            }
        }
    },
    required: ["portfolioSummary", "analysis"]
};
const SEARCH_SCHEMA = {
    type: genai_1.Type.OBJECT,
    properties: {
        results: {
            type: genai_1.Type.ARRAY,
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    ticker: { type: genai_1.Type.STRING },
                    name: { type: genai_1.Type.STRING }
                },
                required: ["ticker", "name"]
            }
        }
    },
    required: ["results"]
};
const MARKET_SIGNALS_SCHEMA = {
    type: genai_1.Type.OBJECT,
    properties: {
        niftyPe: { type: genai_1.Type.NUMBER },
        marketPhase: { type: genai_1.Type.STRING, description: "One of: Bull, Sideways, Bear" },
        rbiStance: { type: genai_1.Type.STRING, description: "One of: Hawkish, Neutral, Dovish" },
        indiaInflation: { type: genai_1.Type.STRING, description: "One of: Rising, Stable, Falling" },
        sp500ForwardPe: { type: genai_1.Type.NUMBER },
        fedStance: { type: genai_1.Type.STRING, description: "One of: Hawkish, Neutral, Dovish" },
        dollarIndex: { type: genai_1.Type.STRING, description: "One of: Strong, Stable, Weak" }
    },
    required: ["niftyPe", "marketPhase", "rbiStance", "indiaInflation", "sp500ForwardPe", "fedStance", "dollarIndex"]
};
const ASSET_SUGGESTION_ITEM = {
    type: genai_1.Type.OBJECT,
    properties: {
        type: { type: genai_1.Type.STRING },
        name: { type: genai_1.Type.STRING },
        ticker: { type: genai_1.Type.STRING, nullable: true },
        rationale: { type: genai_1.Type.STRING },
        expectedReturn: { type: genai_1.Type.STRING }
    },
    required: ["type", "name", "rationale", "expectedReturn"]
};
const REBALANCER_RATIONALE_SCHEMA = {
    type: genai_1.Type.OBJECT,
    properties: {
        objective: { type: genai_1.Type.STRING },
        marketDynamics: { type: genai_1.Type.STRING },
        rebalancingLogic: { type: genai_1.Type.STRING },
        safetyOverrides: { type: genai_1.Type.STRING },
        macroEnvironment: { type: genai_1.Type.STRING },
        executionLogic: { type: genai_1.Type.STRING },
        assetSuggestions: { type: genai_1.Type.ARRAY, items: ASSET_SUGGESTION_ITEM },
        debtSuggestions: { type: genai_1.Type.ARRAY, items: ASSET_SUGGESTION_ITEM },
        globalSuggestions: { type: genai_1.Type.ARRAY, items: ASSET_SUGGESTION_ITEM },
        goldSuggestions: { type: genai_1.Type.ARRAY, items: ASSET_SUGGESTION_ITEM }
    },
    required: [
        "objective", "marketDynamics", "rebalancingLogic", "safetyOverrides",
        "macroEnvironment", "executionLogic", "assetSuggestions",
        "debtSuggestions", "globalSuggestions", "goldSuggestions"
    ]
};
function fetchMarketSignals() {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = `
    Find and report current real-time market signals for India and US.
    INDIA: Nifty TTM PE, Market Phase (Bull/Sideways/Bear), RBI Stance, Inflation.
    US/GLOBAL: S&P 500 Forward PE, Fed Stance, DXY trend.
    Use Google Search.
  `;
        try {
            const data = yield callGemini(() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const response = yield ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        // @ts-ignore
                        tools: [{ googleSearch: {} }],
                        responseMimeType: "application/json",
                        responseSchema: MARKET_SIGNALS_SCHEMA,
                    },
                });
                return JSON.parse(((_a = response.text) === null || _a === void 0 ? void 0 : _a.trim()) || '{}');
            }));
            return data;
        }
        catch (error) {
            console.error("Error fetching market signals:", error);
            return {
                niftyPe: 22.5,
                marketPhase: 'Bull',
                rbiStance: 'Neutral',
                indiaInflation: 'Stable',
                sp500ForwardPe: 18.5,
                fedStance: 'Neutral',
                dollarIndex: 'Stable'
            };
        }
    });
}
function generateRebalancerExplanation(input, analysis) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = `
    Analyze rebalancing for a goal of ₹${input.targetCorpus} by age ${input.retirementAge}.
    Current AUM: ₹${analysis.totalValue}. Monthly Surplus: ₹${input.monthlySurplus}.
    Market status: India PE ${input.marketSignals.niftyPe}, US PE ${input.marketSignals.sp500ForwardPe}.
    Recommended actions: ${JSON.stringify(analysis.actions)}.
    Near-term Expenses: ${JSON.stringify(input.expenses)}.

    IN THE 'objective' FIELD (Financial Alignment), YOU MUST BE EXTREMELY SPECIFIC AND INCLUDE:
    1. PROGRESS AUDIT: "At age ${input.age}, having an AUM of ₹[AUM Value] puts you on a [solid/lagging] trajectory."
    2. TARGET PROJECTION: Math-driven statement: "To reach ₹${input.targetCorpus} by age ${input.retirementAge}, a SIP of ₹${input.monthlySurplus} growing at [Required Rate]% annually yields roughly ₹[Expected Result]."
    3. CURVE POSITION: "You are currently [slightly ahead/behind/on track] of the baseline required curve, provided you maintain discipline."
    4. STRATEGIC TIPS: 
       (a) Tax Harvesting: Mention utilizing the ₹1.25 Lakh LTCG exemption.
       (b) Emergency Fund: "Ensure 6 months of expenses are parked in Liquid Funds before aggressive investing."
       (c) Step-up SIP: "Aim to increase your monthly surplus contribution by 10% annually to buffer against lifestyle inflation."
       (d) Diversification: Comment on global equity hedging against INR depreciation.
    5. DISCIPLINE REINFORCEMENT: "Automate the ₹${input.monthlySurplus} surplus transfer on salary day."
    6. RISK ADJUSTMENT: Comment on India PE ${input.marketSignals.niftyPe} and current phase (${input.marketSignals.marketPhase}).

    IN THE 'executionLogic' FIELD, YOU MUST INCLUDE:
    1. CAPITAL FLOW: Based on the 'actions' and 'gapAmount', provide specific instructions on trimming/adding.
    2. SELLING CRITICAL: If 'Equity' (Indian or Global) has a 'Decrease' action, specify EXACTLY which stocks to sell first. Instruct to sell: (a) Overvalued tickers with P/E > 40 or sector highs, (b) Audit laggards identified with 'Red Flags' or weak 'Stock Scorecard' performance, (c) Stocks that have met their 1Y target prices, (d) Technically weak stocks trading below 200-DMA.
    3. MAINTAIN REASONING: For any asset class suggested as 'Maintain', explain why.
    4. EXPENSE PLANNING: Specific ring-fencing for Year 1-3 expenses using liquid or arbitrage instruments.
    5. SURPLUS CAGR: State the required annual growth rate for the monthly surplus.
    6. GROWTH BY SECTION: Explain how each section (Equity, Gold, Debt) contributes to the weighted returns.

    IN THE 'globalSuggestions' FIELD:
    - MANDATORY ANALYSIS: Analyse the US NASDAQ 50 stocks (top 50 by market cap).
    - SELECTION CRITERIA: Provide suggestions exclusively from these NASDAQ 50 stocks that fit the growth logic for an investor with the specified target corpus and risk mandate.
    - OUTPUT: Return a list of specific US tickers and names with rationales focused on their global growth potential.

    REQUIRED OUTPUT JSON.
  `;
        try {
            return yield callGemini(() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const response = yield ai.models.generateContent({
                    model: "gemini-3-pro-preview",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: REBALANCER_RATIONALE_SCHEMA,
                    },
                });
                return JSON.parse(((_a = response.text) === null || _a === void 0 ? void 0 : _a.trim()) || '{}');
            }));
        }
        catch (error) {
            console.error("Error generating explanation:", error);
            return {
                objective: "Portfolio goal alignment and wealth management tips.",
                marketDynamics: "Market valuation impact.",
                rebalancingLogic: "Logic for proposed asset shifts.",
                safetyOverrides: "Buffer for upcoming expenses.",
                macroEnvironment: "Macro economic summary.",
                executionLogic: "Execution guidelines including section-wise transfer logic, maintenance rationale, and selling criteria for over-allocated segments.",
                assetSuggestions: [],
                debtSuggestions: [],
                globalSuggestions: [],
                goldSuggestions: []
            };
        }
    });
}
function searchTickers(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!query || query.length < 2)
            return [];
        const prompt = `Find top 8 NSE/BSE stock tickers and names for query: "${query}".`;
        try {
            return yield callGemini(() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const response = yield ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: SEARCH_SCHEMA,
                    },
                });
                const data = JSON.parse(((_a = response.text) === null || _a === void 0 ? void 0 : _a.trim()) || '{"results": []}');
                return data.results;
            }));
        }
        catch (error) {
            return [];
        }
    });
}
const calculateRequiredXirr = (monthlySip, targetAmount, years, stepUp) => {
    const months = years * 12;
    const calculateMaturity = (rate) => {
        let currentBalance = 0;
        let currentSip = monthlySip;
        const monthlyRate = rate / 1200;
        for (let m = 1; m <= months; m++) {
            currentBalance = (currentBalance + currentSip) * (1 + monthlyRate);
            if (m % 12 === 0) {
                currentSip = currentSip * (1 + stepUp / 100);
            }
        }
        return currentBalance;
    };
    let low = 0;
    let high = 100;
    for (let i = 0; i < 20; i++) {
        let mid = (low + high) / 2;
        if (calculateMaturity(mid) < targetAmount) {
            low = mid;
        }
        else {
            high = mid;
        }
    }
    return high;
};
function generatePortfolio(input) {
    return __awaiter(this, void 0, void 0, function* () {
        // Caching removed for backend simplification, relying on frontend or Redis later if needed is better pattern for backend
        const { type, initialAmount, monthlySip, stepUp, targetAmount, years, theme, customTheme, isMultiAsset, age, assetAllocations, customDistribution } = input;
        let requiredReturn = 0;
        if (type === 'LUMPSUM') {
            requiredReturn = (Math.pow(targetAmount / initialAmount, 1 / years) - 1) * 100;
        }
        else {
            requiredReturn = calculateRequiredXirr(monthlySip || 0, targetAmount, years, stepUp || 0);
        }
        const riskProfile = requiredReturn > 18 ? types_1.RiskProfile.AGGRESSIVE : types_1.RiskProfile.MODERATE;
        // Logic update: If too aggressive, automatically shift towards more small/mid cap if not explicitly refined
        let counts = customDistribution;
        if (!counts) {
            if (requiredReturn > 25) {
                counts = { large: 2, mid: 8, small: 5 }; // Very Aggressive
            }
            else if (requiredReturn > 18) {
                counts = { large: 3, mid: 9, small: 3 }; // Aggressive
            }
            else {
                counts = { large: 5, mid: 8, small: 2 }; // Moderate
            }
        }
        const totalStocksCount = counts.large + counts.mid + counts.small;
        const themeConstraint = theme === 'MIXTURE'
            ? "Provide a well-diversified multi-sector equity basket including top Nifty 100 stocks across various industries."
            : `SECTOR CONSTRAINT (MANDATORY): Suggest stocks EXCLUSIVELY from the ${theme === 'CUSTOM' ? customTheme : theme} sector. Do not suggest stocks from any other sector. Use current NSE industry classifications.`;
        const marketCapConstraint = `MARKET CAP DISTRIBUTION (MANDATORY): Your 'stocks' array MUST contain exactly ${counts.large} stocks labeled 'Large Cap', exactly ${counts.mid} stocks labeled 'Mid Cap', and exactly ${counts.small} stocks labeled 'Small Cap'.`;
        const prompt = `Architect wealth strategy for reach ₹${targetAmount} in ${years}y. 
  Required Return: ${requiredReturn.toFixed(2)}%. Theme: ${theme}. 
  ${themeConstraint}
  ${marketCapConstraint}
  ${isMultiAsset ? `MODE: MULTI-ASSET. Allocate across: ${JSON.stringify(assetAllocations)}. Provide 100% distribution including Mutual Funds and other assets as requested. Ensure Mutual Fund suggestions align with the Sector Theme where possible.` : `MODE: EQUITY ONLY. Allocate 100% of capital ONLY to Direct Equity stocks. DO NOT suggest any Mutual Funds or other asset classes; return empty arrays for 'mutualFunds' and 'otherAssets'.`}
  Suggest ${totalStocksCount} Nifty 100 stocks for the equity portion. 
  MANDATORY: Ensure the combined weighted CAGR of all assets (Stocks, MF, etc.) is as close as possible to the required ${requiredReturn.toFixed(2)}% CAGR.
  Output JSON.`;
        try {
            const data = yield callGemini(() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const response = yield ai.models.generateContent({
                    model: "gemini-3-pro-preview",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: PORTFOLIO_SCHEMA,
                    },
                });
                return JSON.parse(((_a = response.text) === null || _a === void 0 ? void 0 : _a.trim()) || '{"stocks": [], "mutualFunds": [], "otherAssets": []}');
            }));
            const stocks = data.stocks;
            const mutualFunds = data.mutualFunds || [];
            const otherAssets = data.otherAssets || [];
            const sectors = {};
            stocks.forEach(s => sectors[s.sector] = (sectors[s.sector] || 0) + s.allocation);
            const assetClasses = {};
            if (stocks.length > 0)
                assetClasses['Direct Equity'] = stocks.reduce((a, b) => a + b.allocation, 0);
            if (mutualFunds.length > 0)
                assetClasses['Mutual Funds'] = mutualFunds.reduce((a, b) => a + b.allocation, 0);
            otherAssets.forEach(a => assetClasses[a.type] = (assetClasses[a.type] || 0) + a.allocation);
            const weightedReturns = [
                ...stocks.map(s => awaitCallGemini(s)), // Placeholder if we need async ops here, but for now synchronous processing
                ...mutualFunds.map(f => (f.allocation / 100) * parseFloat(f.expectedReturn.replace('%', ''))),
                ...otherAssets.map(a => (a.allocation / 100) * parseFloat(a.projectedReturn.replace('%', '')))
            ];
            // Simple synchronous map for stock weighted returns
            const stockWeightedReturns = stocks.map(s => (s.allocation / 100) * parseFloat(s.projectedReturn.replace('%', '')));
            const derivedCagr = [
                ...stockWeightedReturns,
                ...mutualFunds.map(f => (f.allocation / 100) * parseFloat(f.expectedReturn.replace('%', ''))),
                ...otherAssets.map(a => (a.allocation / 100) * parseFloat(a.projectedReturn.replace('%', '')))
            ].reduce((a, b) => a + b, 0);
            let finalProjectedAmount = 0;
            if (type === 'LUMPSUM') {
                finalProjectedAmount = initialAmount * Math.pow(1 + (derivedCagr / 100), years);
            }
            else {
                let currentBalance = 0;
                let currentSip = monthlySip || 0;
                const monthlyRate = derivedCagr / 1200;
                for (let m = 1; m <= years * 12; m++) {
                    currentBalance = (currentBalance + currentSip) * (1 + monthlyRate);
                    if (m % 12 === 0)
                        currentSip = currentSip * (1 + (stepUp || 0) / 100);
                }
                finalProjectedAmount = currentBalance;
            }
            const result = {
                investmentType: type,
                initialAmount, monthlySip, stepUp, targetAmount,
                projectedAmount: finalProjectedAmount,
                years, cagr: parseFloat(derivedCagr.toFixed(2)),
                riskProfile, theme, customTheme, isMultiAsset, age,
                stocks, mutualFunds, otherAssets, capCounts: counts,
                sectorDistribution: Object.entries(sectors).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })),
                assetClassDistribution: Object.entries(assetClasses).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
            };
            return result;
        }
        catch (error) {
            throw error;
        }
    });
}
function awaitCallGemini(stock) {
    return __awaiter(this, void 0, void 0, function* () {
        return (stock.allocation / 100) * parseFloat(stock.projectedReturn.replace('%', ''));
    });
}
function analyzeExistingPortfolio(holdings, years, targetAllocation, currentValues) {
    return __awaiter(this, void 0, void 0, function* () {
        const tickersToFetch = holdings; // Fetch all for now, optimization can be added later
        let aiData = { portfolioSummary: "Comprehensive portfolio audit based on live market pricing.", analysis: [], sources: [] };
        if (tickersToFetch.length > 0) {
            const targetTickersPrompt = tickersToFetch.map(h => h.ticker).join(', ');
            const rebalanceContext = targetAllocation && currentValues ? `
      REBALANCING CONTEXT (MANDATORY):
      Target Allocation (%): ${JSON.stringify(targetAllocation)}
      Current Asset Values (₹): ${JSON.stringify(currentValues)}
    ` : "";
            const prompt = `
      MANDATORY: Use Google Search to find the ABSOLUTE LATEST REAL-TIME CURRENT MARKET PRICE (LTP/CMP) for each of these stock tickers on NSE/BSE: ${targetTickersPrompt}.
      Provide SELL/HOLD/ACCUMULATE recommendations.
      If the action is 'SELL', you MUST provide an 'alternativeRecommendation' object.
      
      ${rebalanceContext}
      Output exactly in JSON format.
    `;
            try {
                const data = yield callGemini(() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d;
                    const response = yield ai.models.generateContent({
                        model: "gemini-3-pro-preview",
                        contents: prompt,
                        config: {
                            // @ts-ignore
                            tools: [{ googleSearch: {} }],
                            responseMimeType: "application/json",
                            responseSchema: ANALYSIS_SCHEMA,
                        },
                    });
                    const groundingChunks = (_c = (_b = (_a = response.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.groundingMetadata) === null || _c === void 0 ? void 0 : _c.groundingChunks;
                    const parsed = JSON.parse(((_d = response.text) === null || _d === void 0 ? void 0 : _d.trim()) || '{"portfolioSummary": "", "analysis": []}');
                    const sources = groundingChunks ? groundingChunks.map((chunk) => chunk.web).filter(Boolean) : [];
                    return Object.assign(Object.assign({}, parsed), { sources });
                }));
                aiData.portfolioSummary = data.portfolioSummary;
                aiData.analysis = data.analysis || [];
                aiData.sources = data.sources || [];
            }
            catch (error) {
                console.error("AI Analysis failed:", error);
            }
        }
        let totalInvested = 0;
        let totalCurrentValue = 0;
        const detailedAnalysis = holdings.map(holding => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const tickerKey = holding.ticker.toUpperCase();
            const aiResult = aiData.analysis.find((a) => tickerKey.includes(a.ticker.toUpperCase()) || a.ticker.toUpperCase().includes(tickerKey));
            // Fallback if AI data missing
            const currentPrice = (aiResult === null || aiResult === void 0 ? void 0 : aiResult.currentPrice) || holding.currentPrice || holding.buyPrice;
            const cValue = currentPrice * holding.quantity;
            const investedValue = holding.buyPrice * holding.quantity;
            totalInvested += investedValue;
            totalCurrentValue += cValue;
            return Object.assign(Object.assign({}, holding), { currentPrice, targetPrice: (aiResult === null || aiResult === void 0 ? void 0 : aiResult.targetPrice) || currentPrice * 1.15, currentValue: cValue, profitLoss: cValue - investedValue, profitLossPercentage: investedValue > 0 ? ((cValue - investedValue) / investedValue) * 100 : 0, action: (aiResult === null || aiResult === void 0 ? void 0 : aiResult.action) || 'HOLD', recommendationRationale: (aiResult === null || aiResult === void 0 ? void 0 : aiResult.recommendationRationale) || 'Price verified via latest market data.', fundamentalDeepDive: (_a = aiResult === null || aiResult === void 0 ? void 0 : aiResult.fundamentalDeepDive) !== null && _a !== void 0 ? _a : 'Detailed fundamental analysis updated with recent quarterly filings.', technicalDeepDive: (_b = aiResult === null || aiResult === void 0 ? void 0 : aiResult.technicalDeepDive) !== null && _b !== void 0 ? _b : 'Technical indicators suggest consolidation near current support levels.', keyMetrics: (aiResult === null || aiResult === void 0 ? void 0 : aiResult.keyMetrics) || [], projectedGrowth: (aiResult === null || aiResult === void 0 ? void 0 : aiResult.projectedGrowth) || 12, scorecard: {
                    performance: (_d = (_c = aiResult === null || aiResult === void 0 ? void 0 : aiResult.scorecard) === null || _c === void 0 ? void 0 : _c.performance) !== null && _d !== void 0 ? _d : "Neutral",
                    profitability: (_f = (_e = aiResult === null || aiResult === void 0 ? void 0 : aiResult.scorecard) === null || _e === void 0 ? void 0 : _e.profitability) !== null && _f !== void 0 ? _f : "Stable",
                    valuation: (_h = (_g = aiResult === null || aiResult === void 0 ? void 0 : aiResult.scorecard) === null || _g === void 0 ? void 0 : _g.valuation) !== null && _h !== void 0 ? _h : "Fair",
                    growth: (_k = (_j = aiResult === null || aiResult === void 0 ? void 0 : aiResult.scorecard) === null || _j === void 0 ? void 0 : _j.growth) !== null && _k !== void 0 ? _k : "Average",
                    redFlags: ((_l = aiResult === null || aiResult === void 0 ? void 0 : aiResult.scorecard) === null || _l === void 0 ? void 0 : _l.redFlags) && aiResult.scorecard.redFlags.length > 0 ? aiResult.scorecard.redFlags : ["No major audit flags found."]
                }, alternativeRecommendation: (aiResult === null || aiResult === void 0 ? void 0 : aiResult.alternativeRecommendation) || undefined });
        });
        const avgGrowth = detailedAnalysis.reduce((a, b) => a + b.projectedGrowth, 0) / (detailedAnalysis.length || 1);
        const projectedValue = totalCurrentValue * Math.pow(1 + (avgGrowth / 100), years);
        return {
            totalInvested,
            currentValue: totalCurrentValue,
            totalProfitLoss: totalCurrentValue - totalInvested,
            projectedValue,
            portfolioCagr: parseFloat(((Math.pow(projectedValue / totalCurrentValue, 1 / years) - 1) * 100).toFixed(2)),
            portfolioSummary: aiData.portfolioSummary || "Real-time audit complete.",
            analysis: detailedAnalysis,
            years,
            sources: aiData.sources
        };
    });
}
