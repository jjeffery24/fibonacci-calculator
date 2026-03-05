// ╔═══════════════════════════════════════════════════════════════╗
// ║  Wealth Path Calculator — Simulation Engine                   ║
// ║  © 2026 Healthy Wealthy Investor — All Rights Reserved        ║
// ║  This code is proprietary. Unauthorised copying prohibited.   ║
// ╚═══════════════════════════════════════════════════════════════╝

const ALLOWED_ORIGINS = [
  'https://hwi-wealth-calculator.netlify.app',
  'https://healthywealthyinvestor.com.au',
  'https://www.healthywealthyinvestor.com.au',
  'http://localhost:8888',
  'http://localhost:3000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

// --- Proprietary IP ---

const FIB_MULTIPLIERS = [1, 3, 5, 8, 13];
const STAGE_NAMES = ['Seed', 'Growth', 'Momentum', 'Compound', 'Freedom'];

function getStage(netWorth, annualNet) {
  if (annualNet <= 0) return 1;
  const ratio = netWorth / annualNet;
  if (ratio < 2) return 1;
  if (ratio < 5) return 2;
  if (ratio < 8) return 3;
  if (ratio < 13) return 4;
  return 5;
}

function getTaxOnIncome(gross) {
  // AU 2025-26 brackets
  if (gross <= 18200) return gross * 0.02;
  if (gross <= 45000) return (gross - 18200) * 0.18 + 18200 * 0.02;
  if (gross <= 135000) return 4288 + (gross - 45000) * 0.32 + gross * 0.02;
  if (gross <= 190000) return 31288 + (gross - 135000) * 0.39 + gross * 0.02;
  return 51638 + (gross - 190000) * 0.47 + gross * 0.02;
}

function simulateStream(params) {
  const { currentAge, years, propertyPrice, capGrowth, rentalYield,
          loanRate, maxProps, buildMonths, savingsRatePct, startingCash,
          isSmsf, superBal, salSac, annualGrossStart } = params;

  const inflation = 0.03;
  const sgRate = 0.12;
  const concessionalCap = 30000;
  const superReturn = 0.075;
  const propCosts = 0.015;
  const lvr = 0.80;

  let annualNet, currentAnnualGross;
  const tax = getTaxOnIncome(annualGrossStart);
  annualNet = annualGrossStart - tax;
  currentAnnualGross = annualGrossStart;

  const data = [];
  let superCash = superBal;
  let personalSavings = startingCash;
  let properties = [];
  let totalLoan = 0;
  let numProps = 0;

  for (let y = 0; y <= years; y++) {
    const age = currentAge + y;
    const currentBuildCost = propertyPrice * Math.pow(1 + inflation, y);

    if (y > 0) {
      annualNet *= (1 + inflation);
      currentAnnualGross *= (1 + inflation);
    }
    const annualSavings = annualNet * savingsRatePct;

    // Super contributions
    let sgContrib = 0, salSacActual = 0;
    if (isSmsf) {
      sgContrib = Math.min(currentAnnualGross * sgRate, concessionalCap);
      salSacActual = Math.min(salSac, concessionalCap - sgContrib);
      superCash += sgContrib + salSacActual;
    }

    // Property growth + rental
    let totalPropertyValue = 0, totalRentalIncome = 0;
    let totalLoanInterest = totalLoan * loanRate;

    for (let p of properties) {
      p.age++;
      if (p.age > (buildMonths > 0 ? 1 : 0)) {
        p.value *= (1 + capGrowth);
        totalRentalIncome += p.value * rentalYield * (isSmsf ? 0.80 : 1.0);
      }
      totalPropertyValue += p.value;
    }

    const completedValue = properties.filter(p => p.age > (buildMonths > 0 ? 1 : 0)).reduce((s, p) => s + p.value, 0);
    const propExpenses = completedValue * propCosts;
    const netCashflow = totalRentalIncome - totalLoanInterest - propExpenses;

    if (isSmsf) {
      superCash += netCashflow;
      const taxable = (sgContrib + salSacActual) + totalRentalIncome - totalLoanInterest - propExpenses;
      if (taxable > 0) superCash -= taxable * 0.15;
    } else {
      personalSavings += netCashflow;
    }

    // Loan repayment (IO 5yr then P&I)
    for (let p of properties) {
      if (p.age > 5 && p.loanAmount > 0) {
        const principal = p.loanAmount * 0.025;
        p.loanAmount -= principal;
        totalLoan -= principal;
        if (isSmsf) superCash -= principal; else personalSavings -= principal;
      }
    }

    if (isSmsf && superCash > 0) superCash *= (1 + superReturn * 0.3);

    // Refinance after build
    for (let p of properties) {
      if (p.age === 1 && buildMonths > 0) {
        const loan = p.value * lvr;
        p.loanAmount = loan;
        totalLoan += loan;
        if (isSmsf) superCash += loan - p.depositPaid;
        else personalSavings += loan - p.depositPaid;
      }
    }

    // Acquire
    if (numProps < maxProps && y > 0) {
      const depositReq = currentBuildCost * (1 - lvr);
      const pool = isSmsf ? superCash : personalSavings;
      const buffer = isSmsf ? 50000 : 20000;
      if (pool >= depositReq + buffer) {
        let loanAmt = 0;
        if (buildMonths === 0) { loanAmt = currentBuildCost * lvr; totalLoan += loanAmt; }
        properties.push({ value: currentBuildCost, age: 0, depositPaid: depositReq, loanAmount: loanAmt });
        if (isSmsf) superCash -= depositReq; else personalSavings -= depositReq;
        numProps++;
      }
    }

    personalSavings += annualSavings;
    if (!isSmsf && personalSavings > 0) personalSavings *= (1 + 0.04);

    const totalPropertyEquity = properties.reduce((s, p) => s + p.value - (p.loanAmount || 0), 0);
    const totalAssets = (isSmsf ? superCash + totalPropertyValue : 0) + personalSavings;
    const totalDebt = totalLoan;

    let passiveIncome;
    if (isSmsf) {
      passiveIncome = personalSavings * 0.04;
    } else {
      passiveIncome = totalRentalIncome - totalLoanInterest - propExpenses + personalSavings * 0.04;
    }

    data.push({
      year: y, age,
      totalPropertyValue, totalPropertyEquity, totalRentalIncome,
      personalSavings, superCash: isSmsf ? superCash : 0,
      totalAssets, totalDebt, passiveIncome, annualNet, numProps
    });
  }
  return data;
}

exports.handler = async function(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const input = JSON.parse(event.body);

    const currentAge = input.currentAge || 30;
    const targetAge = 75;
    const years = targetAge - currentAge;
    const annualGross = input.householdIncome || 0;
    const propertyPrice = input.propertyPrice || 0;
    const depositAvail = input.depositAvailable || 0;
    const capGrowth = (input.growthRate || 6) / 100;
    const rentalYield = (input.rentalYield || 5) / 100;
    const loanRate = (input.loanRate || 6.6) / 100;
    const buildMonths = input.buildPeriod || 0;
    const savingsRatePct = (input.savingsRate || 20) / 100;
    const mode = input.structure || 'personal';

    let data;

    if (mode === 'both') {
      const personalData = simulateStream({
        currentAge, years, propertyPrice, capGrowth, rentalYield, loanRate,
        maxProps: input.maxPropsPersonal || 3, buildMonths, savingsRatePct,
        startingCash: depositAvail, isSmsf: false, superBal: 0, salSac: 0,
        annualGrossStart: annualGross
      });
      const smsfData = simulateStream({
        currentAge, years, propertyPrice, capGrowth, rentalYield, loanRate,
        maxProps: input.maxPropsSmsf || 2, buildMonths, savingsRatePct,
        startingCash: 0, isSmsf: true, superBal: input.superBalanceBoth || 0,
        salSac: input.salSacBoth || 0, annualGrossStart: annualGross
      });

      data = personalData.map((pd, i) => {
        const sd = smsfData[i];
        const totalPropertyValue = pd.totalPropertyValue + sd.totalPropertyValue;
        const totalPropertyEquity = pd.totalPropertyEquity + sd.totalPropertyEquity;
        const totalDebt = pd.totalDebt + sd.totalDebt;
        const totalEquity = totalPropertyEquity + pd.personalSavings + sd.superCash;
        const netWorth = totalEquity;
        return {
          year: pd.year, age: pd.age,
          totalPropertyValue, totalPropertyEquity,
          personalSavings: pd.personalSavings, superCash: sd.superCash,
          totalDebt,
          totalEquity,
          netWorth,
          passiveIncome: pd.passiveIncome + sd.passiveIncome,
          annualNet: pd.annualNet,
          numProps: pd.numProps + sd.numProps,
          stage: getStage(netWorth, pd.annualNet),
          stageName: STAGE_NAMES[getStage(netWorth, pd.annualNet) - 1],
          wealthRatio: pd.annualNet > 0 ? netWorth / pd.annualNet : 0
        };
      });
    } else {
      const isSmsf = mode === 'smsf';
      const streamData = simulateStream({
        currentAge, years, propertyPrice, capGrowth, rentalYield, loanRate,
        maxProps: input.maxProperties || 3, buildMonths, savingsRatePct,
        startingCash: depositAvail, isSmsf,
        superBal: isSmsf ? (input.superBalance || 0) : 0,
        salSac: isSmsf ? (input.salSac || 0) : 0,
        annualGrossStart: annualGross
      });

      data = streamData.map(d => {
        const totalEquity = d.totalPropertyEquity + d.personalSavings + d.superCash;
        const netWorth = totalEquity;
        return {
          ...d,
          totalEquity,
          netWorth,
          stage: getStage(netWorth, d.annualNet),
          stageName: STAGE_NAMES[getStage(netWorth, d.annualNet) - 1],
          wealthRatio: d.annualNet > 0 ? netWorth / d.annualNet : 0
        };
      });
    }

    const final = data[data.length - 1];
    const result = {
      yearData: data,
      kpis: {
        totalWealth: final.totalEquity,
        totalEquity: final.totalEquity,
        totalPropertyValue: final.totalPropertyValue,
        passiveIncome: final.passiveIncome,
        propertiesCount: final.numProps,
        stageReached: final.stage,
        stageName: final.stageName
      }
    };

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request', details: err.message })
    };
  }
};
