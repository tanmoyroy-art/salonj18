/**
 * EMI Calculator Utility
 * Handles calculation of installment plans based on total amount and EMI option
 */

/**
 * Calculate EMI plan based on payment plan type and installment months
 * @param {number} totalAmount - Total course fees
 * @param {string} paymentPlan - 'full' or 'installment'
 * @param {number} months - Number of months for installment (4, 6, or 9)
 * @returns {object} EMI plan object with installments array
 */
function calculateEMI(totalAmount, paymentPlan, months = 4) {
  // If full payment, return single installment
  if (paymentPlan === 'full') {
    return {
      planType: 'full',
      totalAmount: totalAmount,
      numberOfInstallments: 1,
      installments: [
        {
          installmentNumber: 1,
          amount: totalAmount,
          daysFromNow: 0,
          percentage: 100
        }
      ]
    };
  }

  // EMI Plans: 4-month, 6-month, 9-month
  const emiOptions = {
    4: {
      name: '4-Month Plan',
      months: 4,
      downPaymentPercentage: 50, // 50% upfront
      monthlyPercentage: 16.67 // ≈ (50 / 3) per month
    },
    6: {
      name: '6-Month Plan',
      months: 6,
      downPaymentPercentage: 40, // 40% upfront
      monthlyPercentage: 12 // (60 / 5) per month
    },
    9: {
      name: '9-Month Plan',
      months: 9,
      downPaymentPercentage: 30, // 30% upfront
      monthlyPercentage: 7.78 // ≈ (70 / 9) per month
    }
  };

  // Validate months parameter
  if (!emiOptions[months]) {
    months = 4; // Default to 4-month plan
  }

  const selectedPlan = emiOptions[months];
  const numInstallments = selectedPlan.months;
  
  // Calculate down payment
  const downPayment = Math.round(totalAmount * (selectedPlan.downPaymentPercentage / 100));
  const remainingAmount = totalAmount - downPayment;
  const perInstallmentAmount = Math.round(remainingAmount / (numInstallments - 1));
  
  // Build installments array
  const installments = [];
  
  // First installment (down payment) - due immediately
  installments.push({
    installmentNumber: 1,
    amount: downPayment,
    daysFromNow: 0,
    percentage: (downPayment / totalAmount * 100).toFixed(2),
    label: `Upfront Payment (${selectedPlan.downPaymentPercentage}%)`
  });
  
  // Remaining installments - due 30 days apart
  let amountCovered = downPayment;
  for (let i = 2; i <= numInstallments; i++) {
    let amount = perInstallmentAmount;
    
    // Adjust last installment to ensure exact total
    if (i === numInstallments) {
      amount = totalAmount - amountCovered;
    }
    
    const monthNumber = i - 1;
    installments.push({
      installmentNumber: i,
      amount: amount,
      daysFromNow: (i - 1) * 30, // 30 days apart
      percentage: (amount / totalAmount * 100).toFixed(2),
      label: `Month ${monthNumber}`,
      dueDateDescription: `After ${(i - 1) * 30} days`
    });
    
    amountCovered += amount;
  }
  
  return {
    planType: 'installment',
    planName: selectedPlan.name,
    planMonths: months,
    totalAmount: totalAmount,
    numberOfInstallments: numInstallments,
    downPaymentPercentage: selectedPlan.downPaymentPercentage,
    monthlyPercentage: selectedPlan.monthlyPercentage,
    monthlyAmount: Math.round(remainingAmount / (numInstallments - 1)),
    installments: installments
  };
}

/**
 * Generate payment schedule dates
 * @param {array} installments - Array of installment objects
 * @returns {array} Installments with calculated due dates
 */
function generatePaymentScheduleDates(installments) {
  const today = new Date();
  
  return installments.map(installment => ({
    ...installment,
    dueDate: new Date(today.getTime() + installment.daysFromNow * 24 * 60 * 60 * 1000)
  }));
}

/**
 * Get EMI summary for display
 * @param {number} totalAmount - Total amount
 * @param {string} paymentPlan - Payment plan type
 * @param {number} months - Number of months
 * @returns {string} Formatted EMI summary
 */
function getEMISummary(totalAmount, paymentPlan, months = 4) {
  const plan = calculateEMI(totalAmount, paymentPlan, months);
  
  if (plan.planType === 'full') {
    return `Full Payment: ₹${totalAmount.toLocaleString('en-IN')}`;
  }
  
  let summary = `${plan.planName}: `;
  const first = plan.installments[0];
  const second = plan.installments[1];
  
  summary += `₹${first.amount.toLocaleString('en-IN')} today + `;
  summary += `₹${second.amount.toLocaleString('en-IN')} × ${plan.numberOfInstallments - 1} months`;
  
  return summary;
}

module.exports = {
  calculateEMI,
  generatePaymentScheduleDates,
  getEMISummary
};
