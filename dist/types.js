"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanTier = exports.RiskProfile = exports.MarketCap = void 0;
var MarketCap;
(function (MarketCap) {
    MarketCap["LARGE"] = "Large Cap";
    MarketCap["MID"] = "Mid Cap";
    MarketCap["SMALL"] = "Small Cap";
})(MarketCap || (exports.MarketCap = MarketCap = {}));
var RiskProfile;
(function (RiskProfile) {
    RiskProfile["MODERATE"] = "Moderate";
    RiskProfile["AGGRESSIVE"] = "Aggressive";
})(RiskProfile || (exports.RiskProfile = RiskProfile = {}));
var PlanTier;
(function (PlanTier) {
    PlanTier["FREE"] = "Free";
    PlanTier["PLUS"] = "Plus";
    PlanTier["PREMIUM"] = "Premium";
})(PlanTier || (exports.PlanTier = PlanTier = {}));
