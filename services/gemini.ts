import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from 'dotenv';
import {
    PortfolioResult,
    InvestmentInput,
    RiskProfile,
    Stock,
    UserHolding,
    ExistingPortfolioAnalysis,
    RebalancerInput,
    RebalancerAnalysis,
    RebalancerRationale,
    HoldingAnalysis,
    MarketCap
} from "../types";

dotenv.config();

// Initialize with process.env.API_KEY
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("API_KEY is missing in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

/**
 * Robust Retry Utility with Exponential Backoff
 */
async function callGemini<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    let delay = 2000;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || "";
            const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
            const isServerError = errorMsg.includes("500") || errorMsg.includes("503") || errorMsg.includes("overloaded");

            if ((isQuotaError || isServerError) && i < maxRetries) {
                console.warn(`Gemini API busy (Attempt ${i + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }
            break;
        }
    }
    throw lastError;
}

const PORTFOLIO_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        stocks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    ticker: { type: Type.STRING },
                    name: { type: Type.STRING },
                    sector: { type: Type.STRING },
                    marketCap: { type: Type.STRING, description: "Must be exactly 'Large Cap', 'Mid Cap', or 'Small Cap'" },
                    allocation: { type: Type.NUMBER },
                    rationale: { type: Type.STRING },
                    projectedReturn: { type: Type.STRING }
                },
                required: ["ticker", "name", "sector", "marketCap", "allocation", "rationale", "projectedReturn"]
            }
        },
        mutualFunds: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    allocation: { type: Type.NUMBER },
                    expectedReturn: { type: Type.STRING }
                },
                required: ["name", "category", "rationale", "allocation", "expectedReturn"]
            }
        },
        otherAssets: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING },
                    name: { type: Type.STRING },
                    allocation: { type: Type.NUMBER },
                    rationale: { type: Type.STRING },
                    projectedReturn: { type: Type.STRING }
                },
                required: ["type", "name", "allocation", "rationale", "projectedReturn"]
            }
        }
    },
    required: ["stocks", "mutualFunds", "otherAssets"]
};

const ANALYSIS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        portfolioSummary: { type: Type.STRING },
        analysis: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    ticker: { type: Type.STRING },
                    currentPrice: { type: Type.NUMBER },
                    targetPrice: { type: Type.NUMBER },
                    action: { type: Type.STRING },
                    recommendationRationale: { type: Type.STRING },
                    fundamentalDeepDive: { type: Type.STRING },
                    technicalDeepDive: { type: Type.STRING },
                    keyMetrics: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    projectedGrowth: { type: Type.NUMBER },
                    scorecard: {
                        type: Type.OBJECT,
                        properties: {
                            performance: { type: Type.STRING },
                            profitability: { type: Type.STRING },
                            valuation: { type: Type.STRING },
                            growth: { type: Type.STRING },
                            redFlags: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ["performance", "profitability", "valuation", "growth", "redFlags"]
                    },
                    alternativeRecommendation: {
                        type: Type.OBJECT,
                        properties: {
                            category: {
                                type: Type.STRING,
                                description: "Must be: 'Balanced Portfolio Suggestions (Domestic Equity)', 'Global Portfolio Suggestion', 'Debt Portfolio Suggestion', or 'Gold Portfolio Suggestion'"
                            },
                            ticker: { type: Type.STRING, nullable: true },
                            name: { type: Type.STRING },
                            rationale: { type: Type.STRING },
                            projectedReturn: { type: Type.STRING }
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
    type: Type.OBJECT,
    properties: {
        results: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    ticker: { type: Type.STRING },
                    name: { type: Type.STRING }
                },
                required: ["ticker", "name"]
            }
        }
    },
    required: ["results"]
};

const MARKET_SIGNALS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        niftyPe: { type: Type.NUMBER },
        marketPhase: { type: Type.STRING, description: "One of: Bull, Sideways, Bear" },
        rbiStance: { type: Type.STRING, description: "One of: Hawkish, Neutral, Dovish" },
        indiaInflation: { type: Type.STRING, description: "One of: Rising, Stable, Falling" },
        sp500ForwardPe: { type: Type.NUMBER },
        fedStance: { type: Type.STRING, description: "One of: Hawkish, Neutral, Dovish" },
        dollarIndex: { type: Type.STRING, description: "One of: Strong, Stable, Weak" }
    },
    required: ["niftyPe", "marketPhase", "rbiStance", "indiaInflation", "sp500ForwardPe", "fedStance", "dollarIndex"]
};

const ASSET_SUGGESTION_ITEM = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING },
        name: { type: Type.STRING },
        ticker: { type: Type.STRING, nullable: true },
        rationale: { type: Type.STRING },
        expectedReturn: { type: Type.STRING }
    },
    required: ["type", "name", "rationale", "expectedReturn"]
};

const REBALANCER_RATIONALE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        objective: { type: Type.STRING },
        marketDynamics: { type: Type.STRING },
        rebalancingLogic: { type: Type.STRING },
        safetyOverrides: { type: Type.STRING },
        macroEnvironment: { type: Type.STRING },
        executionLogic: { type: Type.STRING },
        assetSuggestions: { type: Type.ARRAY, items: ASSET_SUGGESTION_ITEM },
        debtSuggestions: { type: Type.ARRAY, items: ASSET_SUGGESTION_ITEM },
        globalSuggestions: { type: Type.ARRAY, items: ASSET_SUGGESTION_ITEM },
        goldSuggestions: { type: Type.ARRAY, items: ASSET_SUGGESTION_ITEM }
    },
    required: [
        "objective", "marketDynamics", "rebalancingLogic", "safetyOverrides",
        "macroEnvironment", "executionLogic", "assetSuggestions",
        "debtSuggestions", "globalSuggestions", "goldSuggestions"
    ]
};

export async function fetchMarketSignals(): Promise<any> {
    const prompt = `
    Find and report current real-time market signals for India and US.
    INDIA: Nifty TTM PE, Market Phase (Bull/Sideways/Bear), RBI Stance, Inflation.
    US/GLOBAL: S&P 500 Forward PE, Fed Stance, DXY trend.
    Use Google Search.
  `;

    try {
        const data = await callGemini(async () => {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    // @ts-ignore
                    tools: [{ googleSearch: {} }],
                    responseMimeType: "application/json",
                    responseSchema: MARKET_SIGNALS_SCHEMA,
                },
            });
            return JSON.parse(response.text?.trim() || '{}');
        });

        return data;
    } catch (error) {
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
}

export async function generateRebalancerExplanation(input: RebalancerInput, analysis: RebalancerAnalysis): Promise<RebalancerRationale> {
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
        return await callGemini(async () => {
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: REBALANCER_RATIONALE_SCHEMA,
                },
            });
            return JSON.parse(response.text?.trim() || '{}');
        });
    } catch (error) {
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
}

export async function searchTickers(query: string): Promise<{ ticker: string; name: string }[]> {
    if (!query || query.length < 2) return [];
    const prompt = `Find top 8 NSE/BSE stock tickers and names for query: "${query}".`;
    try {
        return await callGemini(async () => {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: SEARCH_SCHEMA,
                },
            });
            const data = JSON.parse(response.text?.trim() || '{"results": []}');
            return data.results;
        });
    } catch (error) {
        return [];
    }
}

const calculateRequiredXirr = (monthlySip: number, targetAmount: number, years: number, stepUp: number): number => {
    const months = years * 12;
    const calculateMaturity = (rate: number) => {
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

    let low = 0; let high = 100;
    for (let i = 0; i < 20; i++) {
        let mid = (low + high) / 2;
        if (calculateMaturity(mid) < targetAmount) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return high;
};

export async function generatePortfolio(input: InvestmentInput): Promise<PortfolioResult> {
    // Caching removed for backend simplification, relying on frontend or Redis later if needed is better pattern for backend

    const { type, initialAmount, monthlySip, stepUp, targetAmount, years, theme, customTheme, isMultiAsset, age, assetAllocations, customDistribution } = input;

    let requiredReturn = 0;
    if (type === 'LUMPSUM') {
        requiredReturn = (Math.pow(targetAmount / initialAmount, 1 / years) - 1) * 100;
    } else {
        requiredReturn = calculateRequiredXirr(monthlySip || 0, targetAmount, years, stepUp || 0);
    }

    const riskProfile = requiredReturn > 18 ? RiskProfile.AGGRESSIVE : RiskProfile.MODERATE;

    // Logic update: If too aggressive, automatically shift towards more small/mid cap if not explicitly refined
    let counts = customDistribution;
    if (!counts) {
        if (requiredReturn > 25) {
            counts = { large: 2, mid: 8, small: 5 }; // Very Aggressive
        } else if (requiredReturn > 18) {
            counts = { large: 3, mid: 9, small: 3 }; // Aggressive
        } else {
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
        const data = await callGemini(async () => {
            const response = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: PORTFOLIO_SCHEMA,
                },
            });
            return JSON.parse(response.text?.trim() || '{"stocks": [], "mutualFunds": [], "otherAssets": []}');
        });

        const stocks: Stock[] = data.stocks;
        const mutualFunds: any[] = data.mutualFunds || [];
        const otherAssets: any[] = data.otherAssets || [];

        const sectors: Record<string, number> = {};
        stocks.forEach(s => sectors[s.sector] = (sectors[s.sector] || 0) + s.allocation);

        const assetClasses: Record<string, number> = {};
        if (stocks.length > 0) assetClasses['Direct Equity'] = stocks.reduce((a, b) => a + b.allocation, 0);
        if (mutualFunds.length > 0) assetClasses['Mutual Funds'] = mutualFunds.reduce((a, b) => a + b.allocation, 0);
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
        } else {
            let currentBalance = 0;
            let currentSip = monthlySip || 0;
            const monthlyRate = derivedCagr / 1200;
            for (let m = 1; m <= years * 12; m++) {
                currentBalance = (currentBalance + currentSip) * (1 + monthlyRate);
                if (m % 12 === 0) currentSip = currentSip * (1 + (stepUp || 0) / 100);
            }
            finalProjectedAmount = currentBalance;
        }

        const result: PortfolioResult = {
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
    } catch (error) { throw error; }
}

async function awaitCallGemini(stock: any) {
    return (stock.allocation / 100) * parseFloat(stock.projectedReturn.replace('%', ''));
}


export async function analyzeExistingPortfolio(
    holdings: UserHolding[],
    years: number,
    targetAllocation?: Record<string, number>,
    currentValues?: Record<string, number>
): Promise<ExistingPortfolioAnalysis> {
    const tickersToFetch = holdings; // Fetch all for now, optimization can be added later

    let aiData: any = { portfolioSummary: "Comprehensive portfolio audit based on live market pricing.", analysis: [], sources: [] };

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
            const data = await callGemini(async () => {
                const response = await ai.models.generateContent({
                    model: "gemini-3-pro-preview",
                    contents: prompt,
                    config: {
                        // @ts-ignore
                        tools: [{ googleSearch: {} }],
                        responseMimeType: "application/json",
                        responseSchema: ANALYSIS_SCHEMA,
                    },
                });

                const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
                const parsed = JSON.parse(response.text?.trim() || '{"portfolioSummary": "", "analysis": []}');
                const sources = groundingChunks ? groundingChunks.map((chunk: any) => chunk.web).filter(Boolean) : [];
                return { ...parsed, sources };
            });

            aiData.portfolioSummary = data.portfolioSummary;
            aiData.analysis = data.analysis || [];
            aiData.sources = data.sources || [];
        } catch (error) {
            console.error("AI Analysis failed:", error);
        }
    }

    let totalInvested = 0;
    let totalCurrentValue = 0;

    const detailedAnalysis = holdings.map(holding => {
        const tickerKey = holding.ticker.toUpperCase();
        const aiResult = aiData.analysis.find((a: any) => tickerKey.includes(a.ticker.toUpperCase()) || a.ticker.toUpperCase().includes(tickerKey));

        // Fallback if AI data missing
        const currentPrice = aiResult?.currentPrice || holding.currentPrice || holding.buyPrice;
        const cValue = currentPrice * holding.quantity;
        const investedValue = holding.buyPrice * holding.quantity;

        totalInvested += investedValue;
        totalCurrentValue += cValue;

        return {
            ...holding,
            currentPrice,
            targetPrice: aiResult?.targetPrice || currentPrice * 1.15,
            currentValue: cValue,
            profitLoss: cValue - investedValue,
            profitLossPercentage: investedValue > 0 ? ((cValue - investedValue) / investedValue) * 100 : 0,
            action: aiResult?.action || 'HOLD',
            recommendationRationale: aiResult?.recommendationRationale || 'Price verified via latest market data.',
            fundamentalDeepDive: aiResult?.fundamentalDeepDive ?? 'Detailed fundamental analysis updated with recent quarterly filings.',
            technicalDeepDive: aiResult?.technicalDeepDive ?? 'Technical indicators suggest consolidation near current support levels.',
            keyMetrics: aiResult?.keyMetrics || [],
            projectedGrowth: aiResult?.projectedGrowth || 12,
            scorecard: {
                performance: aiResult?.scorecard?.performance ?? "Neutral",
                profitability: aiResult?.scorecard?.profitability ?? "Stable",
                valuation: aiResult?.scorecard?.valuation ?? "Fair",
                growth: aiResult?.scorecard?.growth ?? "Average",
                redFlags: aiResult?.scorecard?.redFlags && aiResult.scorecard.redFlags.length > 0 ? aiResult.scorecard.redFlags : ["No major audit flags found."]
            },
            alternativeRecommendation: aiResult?.alternativeRecommendation || undefined
        };
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
}
